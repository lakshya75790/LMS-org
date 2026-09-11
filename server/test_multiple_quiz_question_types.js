const http = require('http');
const app = require('./app');
const { prisma } = require('./config/prismaClient');
const bcrypt = require('bcryptjs');

function makeRequest(server, { method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const url = `http://localhost:${address.port}${path}`;
    const reqHeaders = { ...headers };
    let bodyData = null;

    if (body) {
      bodyData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        const setCookie = res.headers['set-cookie'];
        const cookie = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : null;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookie,
          body: parsed
        });
      });
    });

    req.on('error', err => reject(err));
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function runTest() {
  console.log('--- STARTING MULTIPLE QUIZ QUESTION TYPES END-TO-END TEST ---');

  const server = app.listen(0, async () => {
    const ts = Date.now();
    try {
      const adminEmail = `quiz_multi_admin_${ts}@test.com`;
      const instEmail = `quiz_multi_inst_${ts}@test.com`;
      const empEmail = `quiz_multi_emp_${ts}@test.com`;
      const passwordHash = await bcrypt.hash('Password123!', 10);

      // 1. Setup Org & Users directly in Prisma
      console.log('1. Setting up Org, Admin, Instructor, and Employee...');
      const org = await prisma.organization.create({
        data: {
          name: `Multi Question Test Org ${ts}`,
          code: `MQT${ts.toString().slice(-6)}`
        }
      });

      const admin = await prisma.user.create({
        data: {
          name: 'Quiz Admin',
          email: adminEmail,
          password: passwordHash,
          role: 'Admin',
          organization: { connect: { id: org.id } }
        }
      });

      const instructor = await prisma.user.create({
        data: {
          name: 'Dr. Quiz Instructor',
          email: instEmail,
          password: passwordHash,
          role: 'Instructor',
          organization: { connect: { id: org.id } }
        }
      });

      const employee = await prisma.user.create({
        data: {
          name: 'Jane Employee',
          email: empEmail,
          password: passwordHash,
          role: 'Employee',
          organization: { connect: { id: org.id } }
        }
      });

      // 2. Login Admin, Instructor and Employee
      console.log('\n2. Logging in Admin, Instructor, and Employee...');
      const adminLogin = await makeRequest(server, {
        method: 'POST',
        path: '/api/auth/login',
        body: { email: adminEmail, password: 'Password123!' }
      });
      const adminCookie = adminLogin.cookie;
      if (!adminCookie) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);

      const instLogin = await makeRequest(server, {
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail, password: 'Password123!' }
      });
      const instCookie = instLogin.cookie;
      if (!instCookie) throw new Error(`Instructor login failed: ${JSON.stringify(instLogin.body)}`);

      const empLogin = await makeRequest(server, {
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123!' }
      });
      const empCookie = empLogin.cookie;
      if (!empCookie) throw new Error(`Employee login failed: ${JSON.stringify(empLogin.body)}`);

      // 3. Create Category
      console.log('\n3. Creating Category...');
      const catRes = await makeRequest(server, {
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: `Tech Category ${ts}` }
      });
      if (catRes.statusCode !== 201) throw new Error(`Category creation failed: ${JSON.stringify(catRes.body)}`);
      const categoryId = catRes.body.data.category._id;

      // 4. Create Training
      console.log('\n4. Instructor creating Training...');
      const trgRes = await makeRequest(server, {
        method: 'POST',
        path: '/api/trainings',
        headers: { Cookie: instCookie },
        body: {
          title: `Multi Quiz Question Types Course ${ts}`,
          description: 'Test training for MCQ, True/False, and Fill in the Blank',
          categoryId,
          sections: [
            {
              title: 'Section 1',
              description: 'Section with 3 question types quiz',
              lectures: [
                { title: 'Lecture 1', description: 'Intro' }
              ]
            }
          ]
        }
      });
      if (trgRes.statusCode !== 201) throw new Error(`Training creation failed: ${JSON.stringify(trgRes.body)}`);
      const trainingId = trgRes.body.data.training._id;

      // 5. Instructor creates Quiz with all 3 question types (MCQ, True/False, Fill in the Blank)
      console.log('\n5. Instructor creating Quiz with MCQ, True/False, and Fill in the Blank questions...');
      const createQuizRes = await makeRequest(server, {
        method: 'POST',
        path: '/api/quizzes',
        headers: { Cookie: instCookie },
        body: {
          title: 'Mixed Questions Quiz',
          trainingId,
          timeLimitMinutes: 15,
          passingScorePercent: 70,
          questions: [
            {
              questionType: 'MCQ',
              questionText: 'What is the primary capital of France?',
              options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
              correctAnswerIndex: 2
            },
            {
              questionType: 'TRUE_FALSE',
              questionText: 'JavaScript is a single-threaded execution language.',
              options: ['True', 'False'],
              correctAnswerIndex: 0,
              correctAnswerText: 'True'
            },
            {
              questionType: 'FILL_IN_BLANK',
              questionText: 'The acronym HTTP stands for Hypertext ________ Protocol.',
              options: [],
              correctAnswerText: 'Transfer'
            }
          ]
        }
      });

      console.log('   Create Quiz Response Status:', createQuizRes.statusCode);
      if (createQuizRes.statusCode !== 201) {
        throw new Error(`Create multi-type quiz failed: ${JSON.stringify(createQuizRes.body)}`);
      }

      const quiz = createQuizRes.body.data.quiz;
      console.log(`   Quiz created successfully with ID: ${quiz._id}`);
      console.log(`   Questions created:`, quiz.questions.map(q => ({ text: q.questionText, type: q.questionType, options: q.options, correctIdx: q.correctAnswerIndex, correctText: q.correctAnswerText })));

      // 6. Employee fetches quiz & start attempt (verifying correct answer masking)
      console.log('\n6. Employee fetching Quiz (verifying masking)...');
      const getQuizRes = await makeRequest(server, {
        method: 'GET',
        path: `/api/quizzes/${quiz._id}`,
        headers: { Cookie: empCookie }
      });

      const empQuiz = getQuizRes.body.data.quiz;
      console.log('   Employee fetched quiz questions correctly masked:');
      empQuiz.questions.forEach((q, i) => {
        console.log(`   Q${i+1} (${q.questionType}): "${q.questionText}" | correctAnswerIndex: ${q.correctAnswerIndex} | correctAnswerText: ${q.correctAnswerText}`);
        if (q.correctAnswerIndex !== undefined || q.correctAnswerText !== undefined) {
          throw new Error(`SECURITY FAIL: Correct answer leaked to employee on Q${i+1}!`);
        }
      });

      console.log('\n7. Employee starting Quiz attempt...');
      const startRes = await makeRequest(server, {
        method: 'POST',
        path: `/api/quizzes/${quiz._id}/start`,
        headers: { Cookie: empCookie },
        body: {}
      });

      console.log('   Start Quiz status:', startRes.statusCode);
      const attemptId = startRes.body.data.attempt._id;

      // 7. Employee submits answers for all 3 types (Testing correct evaluation)
      console.log('\n8. Employee submitting answers (all 3 correct)...');
      // Testing case-insensitivity & whitespace trimming for Fill in the Blank ("  traNsfer  ")
      const submitRes = await makeRequest(server, {
        method: 'POST',
        path: `/api/quizzes/${quiz._id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          attemptId,
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 2 }, // MCQ: Paris
            { questionIndex: 1, selectedOptionIndex: 0 }, // True/False: True (index 0)
            { questionIndex: 2, selectedAnswerText: '  traNsfer  ' } // Fill in Blank: "transfer"
          ]
        }
      });

      console.log('   Submit status:', submitRes.statusCode);
      console.log('   Submit result:', submitRes.body.message, `Score: ${submitRes.body.data.percentage}%, Passed: ${submitRes.body.data.passed}`);

      if (submitRes.body.data.percentage !== 100 || !submitRes.body.data.passed) {
        throw new Error(`Quiz evaluation failed! Expected 100% score but got ${submitRes.body.data.percentage}%`);
      }

      const evalAnswers = submitRes.body.data.evaluatedAnswers;
      console.log('   Evaluated Answers breakdown:');
      evalAnswers.forEach((a, i) => {
        console.log(`   Q${i+1} (${a.questionType}): isCorrect=${a.isCorrect}, selectedText="${a.selectedAnswerText}", correctText="${a.correctAnswerText}"`);
        if (!a.isCorrect) {
          throw new Error(`Q${i+1} (${a.questionType}) should have been evaluated as correct!`);
        }
      });

      // 8. Test incorrect answers evaluation
      console.log('\n9. Testing retake & wrong answers evaluation...');
      const start2Res = await makeRequest(server, {
        method: 'POST',
        path: `/api/quizzes/${quiz._id}/start`,
        headers: { Cookie: empCookie },
        body: {}
      });
      const attempt2Id = start2Res.body.data.attempt._id;

      const submit2Res = await makeRequest(server, {
        method: 'POST',
        path: `/api/quizzes/${quiz._id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          attemptId: attempt2Id,
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 0 }, // MCQ: Berlin (Incorrect)
            { questionIndex: 1, selectedOptionIndex: 1 }, // True/False: False (Incorrect)
            { questionIndex: 2, selectedAnswerText: 'WrongAnswer' } // Fill in Blank: Wrong (Incorrect)
          ]
        }
      });

      console.log('   Submit 2 status:', submit2Res.statusCode);
      console.log('   Submit 2 result:', submit2Res.body.message, `Score: ${submit2Res.body.data.percentage}%, Passed: ${submit2Res.body.data.passed}`);

      if (submit2Res.body.data.percentage !== 0 || submit2Res.body.data.passed !== false) {
        throw new Error(`Incorrect answers evaluation failed! Expected 0% score but got ${submit2Res.body.data.percentage}%`);
      }

      // 9. Test backward compatibility: Legacy MCQ Quiz creation and evaluation
      console.log('\n10. Testing backward compatibility (Legacy MCQ quiz without explicit questionType)...');
      const legacyQuizRes = await makeRequest(server, {
        method: 'POST',
        path: '/api/quizzes',
        headers: { Cookie: instCookie },
        body: {
          title: 'Legacy MCQ Quiz',
          trainingId,
          timeLimitMinutes: 10,
          passingScorePercent: 50,
          questions: [
            {
              questionText: 'What is 2 + 2?',
              options: ['3', '4', '5', '6'],
              correctAnswerIndex: 1
            }
          ]
        }
      });

      const legacyQuiz = legacyQuizRes.body.data.quiz;
      console.log(`   Legacy quiz created with questionType: ${legacyQuiz.questions[0].questionType}`);
      if (legacyQuiz.questions[0].questionType !== 'MCQ') {
        throw new Error(`Legacy question did not default to MCQ! Got: ${legacyQuiz.questions[0].questionType}`);
      }

      const legacyStart = await makeRequest(server, {
        method: 'POST',
        path: `/api/quizzes/${legacyQuiz._id}/start`,
        headers: { Cookie: empCookie },
        body: {}
      });

      const legacySubmit = await makeRequest(server, {
        method: 'POST',
        path: `/api/quizzes/${legacyQuiz._id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          attemptId: legacyStart.body.data.attempt._id,
          userAnswers: [{ questionIndex: 0, selectedOptionIndex: 1 }]
        }
      });

      console.log('   Legacy submit result:', legacySubmit.body.message, `Score: ${legacySubmit.body.data.percentage}%`);
      if (legacySubmit.body.data.percentage !== 100) {
        throw new Error('Legacy quiz submission failed!');
      }

      console.log('\n✅ ALL MULTIPLE QUIZ QUESTION TYPES E2E TESTS PASSED SUCCESSFULLY!');
      server.close();
      process.exit(0);

    } catch (err) {
      console.error('\n❌ TEST FAILED:', err);
      server.close();
      process.exit(1);
    }
  });
}

runTest();
