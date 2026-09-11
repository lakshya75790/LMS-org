import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProgressByAssignment,
  completeSubSection,
  getQuizById,
  startQuiz,
  submitQuiz,
  getQuizAttempts,
  getAssignmentById,
  submitAssignment,
  uploadPdf,
  reportQuizSecurityEvent
} from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useNotification } from '../../context/NotificationContext';
import { useFocusMode } from '../../context/FocusContext';
import { formatDate } from '../../utils/formatters';
import {
  ArrowLeft,
  CheckCircle2,
  PlayCircle,
  FileText,
  HelpCircle,
  FileCheck2,
  ChevronRight,
  ChevronLeft,
  Lock,
  Download,
  Award,
  Clock,
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Code2,
  Upload,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const TrainingPlayer = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { setIsFocusMode } = useFocusMode();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Active Item in Syllabus
  // type: 'lesson' | 'quiz' | 'assignment' | 'completed'
  const [activeItem, setActiveItem] = useState(null);

  // Custom Video Player state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxWatchedTime, setMaxWatchedTime] = useState(0);
  const [hasVideoReachedEnd, setHasVideoReachedEnd] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoError, setVideoError] = useState(false);

  // Quiz state & refs
  const [quizData, setQuizData] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizTimeRemaining, setQuizTimeRemaining] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [startingQuiz, setStartingQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Focus Mode states
  const [quizPaused, setQuizPaused] = useState(false);
  const [violationWarning, setViolationWarning] = useState('');
  const lastViolationReportTime = useRef(0);
  const lastViolationReportType = useRef(null);

  // Sync with global Focus Mode layout state
  useEffect(() => {
    if (quizStarted && !quizSubmitted) {
      setIsFocusMode(true);
    } else {
      setIsFocusMode(false);
    }
    return () => setIsFocusMode(false);
  }, [quizStarted, quizSubmitted, setIsFocusMode]);

  const quizTimerRef = useRef(null);
  const isSubmittingQuizRef = useRef(false);
  const quizStartTimeRef = useRef(null);
  const activeQuizAttemptIdRef = useRef(null);

  // Assignment state
  const [assignmentDetails, setAssignmentDetails] = useState(null);
  const [submissionType, setSubmissionType] = useState('github'); // 'github' | 'file'
  const [githubUrl, setGithubUrl] = useState('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const [submittingComplete, setSubmittingComplete] = useState(false);

  const fetchWorkspace = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getProgressByAssignment(assignmentId);
      const payload = res.data.data;
      setData(payload);

      const items = extractSyllabusItems(payload);

      // Auto-resume: Find first incomplete item
      if (!isRefresh || !activeItem) {
        const completedIds = new Set(payload.progress?.completedSubSectionIds?.map(id => id.toString()) || []);
        const passedQuizIds = new Set(payload.quizAttempts?.filter(a => a.passed).map(a => (a.quizId?._id || a.quizId)?.toString()) || []);
        const submittedAssignmentIds = new Set(payload.assignmentSubmissions?.map(s => (s.assignmentId?._id || s.assignmentId)?.toString()) || []);

        let nextActive = items.find(item => {
          if (item.type === 'lesson') return !completedIds.has(item.id.toString());
          if (item.type === 'quiz') return !passedQuizIds.has(item.id.toString());
          if (item.type === 'assignment') return !submittedAssignmentIds.has(item.id.toString());
          return false;
        });

        if (!nextActive && items.length > 0) {
          nextActive = { type: 'completed' };
        }

        setActiveItem(nextActive || items[0]);
      }
    } catch (err) {
      addToast('error', 'Failed to load training workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [assignmentId]);

  useEffect(() => {
    setVideoError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setMaxWatchedTime(0);
    setHasVideoReachedEnd(false);
  }, [activeItem]);

  const formatMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return url;
  };

  // Extract flat list of syllabus items (Lessons, Quizzes, Assignments placed at very end)
  const extractSyllabusItems = (payload) => {
    if (!payload || !payload.assignment || !payload.assignment.trainingId) return [];
    const training = payload.assignment.trainingId;
    const items = [];

    if (training.sections && Array.isArray(training.sections)) {
      training.sections.forEach((sec, sIdx) => {
        if (sec.subSections && Array.isArray(sec.subSections)) {
          sec.subSections.forEach((sub, lIdx) => {
            if (sub.quizId) {
              items.push({
                type: 'quiz',
                id: sub.quizId._id || sub.quizId,
                title: sub.quizId.title || `Quiz ${sIdx + 1}`,
                sectionTitle: sec.title,
                timeLimitMinutes: sub.quizId.timeLimitMinutes || 15,
                passingScorePercent: sub.quizId.passingScorePercent || 70,
                questionsCount: sub.quizId.questions?.length || 0
              });
            } else {
              items.push({
                type: 'lesson',
                id: sub._id || sub.id,
                title: sub.title,
                description: sub.description,
                videoUrl: sub.videoUrl,
                sectionTitle: sec.title,
                durationMinutes: sub.durationMinutes || 10,
                pdfResources: sub.pdfResources || []
              });
            }
          });
        }
      });
    }

    // Append Assignment at very end of all modules if present
    if (training.assignment) {
      items.push({
        type: 'assignment',
        id: training.assignment._id || training.assignment.id,
        title: training.assignment.title || 'Course Project Assignment',
        instructions: training.assignment.instructions,
        sectionTitle: 'Course Project'
      });
    } else if (training.sections) {
      const firstAss = training.sections.flatMap(s => s.subSections || []).find(sub => sub.assignmentId)?.assignmentId;
      if (firstAss) {
        items.push({
          type: 'assignment',
          id: firstAss._id || firstAss,
          title: firstAss.title || 'Course Project Assignment',
          instructions: firstAss.instructions,
          sectionTitle: 'Course Project'
        });
      }
    }

    return items;
  };

  const extractAllCourseResources = (payload) => {
    if (!payload || !payload.assignment || !payload.assignment.trainingId) return [];
    const training = payload.assignment.trainingId;
    const resources = [];

    if (training.resources && Array.isArray(training.resources)) {
      resources.push(...training.resources);
    }

    if (training.sections && Array.isArray(training.sections)) {
      training.sections.forEach(sec => {
        if (sec.subSections && Array.isArray(sec.subSections)) {
          sec.subSections.forEach(sub => {
            if (sub.pdfResources && Array.isArray(sub.pdfResources)) {
              sub.pdfResources.forEach(pdf => {
                resources.push({
                  title: pdf.title || 'Resource PDF',
                  fileUrl: pdf.fileUrl || pdf.pdfUrl || pdf.url,
                  lessonTitle: sub.title
                });
              });
            }
          });
        }
      });
    }

    return resources;
  };

  // Helper to determine status & lock state of a item
  const getItemStatus = (item) => {
    if (!data || !item) return { isCompleted: false, isLocked: false };
    const { progress, quizAttempts, assignmentSubmissions } = data;

    const items = extractSyllabusItems(data);
    const itemIdx = items.findIndex(i => i.id === item.id && i.type === item.type);

    let isCompleted = false;

    if (item.type === 'lesson') {
      const completedIds = new Set(progress?.completedSubSectionIds?.map(id => id.toString()) || []);
      isCompleted = completedIds.has(item.id.toString());
    } else if (item.type === 'quiz') {
      const passedQuiz = quizAttempts?.find(a => (a.quizId?._id || a.quizId)?.toString() === item.id.toString() && a.passed);
      isCompleted = Boolean(passedQuiz);
    } else if (item.type === 'assignment') {
      const submittedAss = assignmentSubmissions?.find(s => (s.assignmentId?._id || s.assignmentId)?.toString() === item.id.toString());
      isCompleted = Boolean(submittedAss);
    }

    // Lock Enforcement: Item is locked if ANY previous item is not completed
    let isLocked = false;
    if (itemIdx > 0) {
      for (let i = 0; i < itemIdx; i++) {
        const prevItem = items[i];
        const prevStatus = getItemStatus(prevItem);
        if (!prevStatus.isCompleted) {
          isLocked = true;
          break;
        }
      }
    }

    return { isCompleted, isLocked };
  };

  // Load Quiz Data when activeItem changes to 'quiz'
  useEffect(() => {
    if (activeItem && activeItem.type === 'quiz') {
      setQuizStarted(false);
      setQuizSubmitted(false);
      setQuizResult(null);
      setSelectedAnswers({});
      setCurrentQuestionIdx(0);

      getQuizById(activeItem.id)
        .then(res => {
          setQuizData(res.data.data.quiz);

          // Check if already attempted & passed
          const existingAttempts = data?.quizAttempts || [];
          const passedAtt = existingAttempts.find(a => (a.quizId?._id || a.quizId)?.toString() === activeItem.id.toString() && a.passed);
          if (passedAtt) {
            setQuizResult({
              passed: true,
              percentage: passedAtt.percentage,
              passingScorePercent: passedAtt.quizId?.passingScorePercent || 70,
              evaluatedAnswers: passedAtt.evaluatedAnswers || []
            });
            setQuizSubmitted(true);
            setQuizStarted(true);
          }
        })
        .catch(err => {
          addToast('error', err.response?.data?.message || 'Failed to load quiz details');
        });
    }
  }, [activeItem]);

  // Focus Mode Event Listeners
  useEffect(() => {
    if (!quizStarted || quizSubmitted) return;

    const reportViolation = async (type) => {
      const now = Date.now();
      if (lastViolationReportType.current === type && now - lastViolationReportTime.current < 5000) return;
      lastViolationReportTime.current = now;
      lastViolationReportType.current = type;
      try {
        await reportQuizSecurityEvent(quizData._id, { eventType: type });
      } catch (err) {
        console.error('Failed to report violation', err);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        const msg = 'Quiz Paused — Please return to Focus Mode to continue.';
        setQuizPaused(true);
        setViolationWarning(msg);
        addToast('warning', msg);
        reportViolation('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        const msg = 'Warning: You left the quiz. Please return to the quiz window and remain in Focus Mode.';
        setQuizPaused(true);
        setViolationWarning(msg);
        addToast('warning', msg);
        reportViolation('tab_switch');
      }
    };

    const handleBlur = () => {
      if (!document.hidden) {
        const msg = 'Warning: You left the quiz. Please return to the quiz window and remain in Focus Mode.';
        setQuizPaused(true);
        setViolationWarning(msg);
        addToast('warning', msg);
        reportViolation('tab_switch');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [quizStarted, quizSubmitted, quizData]);

  const returnToFocusMode = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setQuizPaused(false);
      setViolationWarning('');
      lastViolationReportType.current = null;
      addToast('info', 'Resumed Focus Mode.');
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
      setQuizPaused(false);
      setViolationWarning('');
      lastViolationReportType.current = null;
    }
  };

  // Quiz Timer Effect
  useEffect(() => {
    if (quizStarted && !quizSubmitted && quizTimeRemaining !== null && !quizPaused) {
      if (quizTimeRemaining <= 0) {
        clearInterval(quizTimerRef.current);
        submitQuizAnswers(true); // Auto-submit when time expires
      } else {
        quizTimerRef.current = setInterval(() => {
          setQuizTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(quizTimerRef.current);
              submitQuizAnswers(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    return () => clearInterval(quizTimerRef.current);
  }, [quizStarted, quizSubmitted, quizTimeRemaining, quizPaused]);

  const handleStartQuiz = async () => {
    if (!quizData) return;
    setStartingQuiz(true);
    try {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }

      const res = await startQuiz(quizData._id, { trainingAssignmentId: assignmentId });
      const attempt = res.data.data.attempt;
      activeQuizAttemptIdRef.current = attempt._id;
      quizStartTimeRef.current = new Date();

      const timeLimitSecs = (quizData.timeLimitMinutes || 15) * 60;
      setQuizTimeRemaining(timeLimitSecs);
      setQuizStarted(true);
      setQuizPaused(false);
      setViolationWarning('');
      setQuizSubmitted(false);
      setSelectedAnswers({});
      setCurrentQuestionIdx(0);
      addToast('success', 'Quiz timer started! Good luck.');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to start quiz');
    } finally {
      setStartingQuiz(false);
    }
  };

  const submitQuizAnswers = async (isAutoSubmit = false) => {
    if (isSubmittingQuizRef.current || quizSubmitted) return;
    isSubmittingQuizRef.current = true;
    setSubmittingQuiz(true);
    clearInterval(quizTimerRef.current);

    try {
      const formattedAnswers = (quizData.questions || []).map((qObj, qIdx) => {
        const ansVal = selectedAnswers[qIdx];
        const qType = qObj.questionType || (qObj.options && qObj.options.length > 0 ? 'MCQ' : 'FILL_IN_BLANK');

        if (qType === 'FILL_IN_BLANK') {
          return {
            questionIndex: qIdx,
            questionIdx: qIdx,
            selectedAnswerText: ansVal !== undefined && ansVal !== null ? String(ansVal).trim() : ''
          };
        } else {
          const optIdx = ansVal !== undefined && ansVal !== null && !isNaN(Number(ansVal)) ? Number(ansVal) : null;
          return {
            questionIndex: qIdx,
            questionIdx: qIdx,
            selectedOptionIndex: optIdx,
            selectedOptionIdx: optIdx
          };
        }
      });

      const res = await submitQuiz(quizData._id, {
        trainingAssignmentId: assignmentId,
        quizAttemptId: activeQuizAttemptIdRef.current,
        attemptId: activeQuizAttemptIdRef.current,
        userAnswers: formattedAnswers,
        answers: formattedAnswers
      });

      const resData = res.data.data;
      setQuizResult(resData);
      setQuizSubmitted(true);
      setQuizStarted(true);
      setQuizPaused(false);

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.warn(e));
      }

      if (!isAutoSubmit) {
        if (resData.passed) {
          addToast('success', 'Congratulations! You passed the quiz.');
        } else {
          addToast('error', `Quiz failed (${resData.percentage}%). Required passing score: ${resData.passingScorePercent}%. Please retake.`);
        }
      }
      fetchWorkspace(true);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to submit quiz');
    } finally {
      setSubmittingQuiz(false);
      isSubmittingQuizRef.current = false;
    }
  };

  // Load Active Assignment details
  useEffect(() => {
    if (activeItem && activeItem.type === 'assignment') {
      getAssignmentById(activeItem.id)
        .then(res => {
          setAssignmentDetails(res.data.data.assignment);
          if (res.data.data.userSubmission) {
            setExistingSubmission(res.data.data.userSubmission);
            setSubmissionType(res.data.data.userSubmission.submissionType);
            if (res.data.data.userSubmission.githubUrl) setGithubUrl(res.data.data.userSubmission.githubUrl);
            if (res.data.data.userSubmission.fileUrl) setUploadedFileUrl(res.data.data.userSubmission.fileUrl);
          }
        })
        .catch(err => {
          addToast('error', err.response?.data?.message || 'Failed to load assignment');
        });
    }
  }, [activeItem]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadingFile(true);
    try {
      const res = await uploadPdf(formData);
      setUploadedFileUrl(res.data.data.url);
      addToast('success', 'Assignment file uploaded successfully!');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentDetails) return;

    if (submissionType === 'github' && (!githubUrl || !githubUrl.includes('github.com'))) {
      addToast('error', 'Please enter a valid GitHub Repository URL (e.g., https://github.com/user/repo)');
      return;
    }

    if (submissionType === 'file' && !uploadedFileUrl) {
      addToast('error', 'Please choose and upload a project file first');
      return;
    }

    setSubmittingAssignment(true);
    try {
      const res = await submitAssignment(assignmentDetails._id, {
        submissionType,
        githubUrl: submissionType === 'github' ? githubUrl : undefined,
        fileUrl: submissionType === 'file' ? uploadedFileUrl : undefined,
        trainingAssignmentId: assignmentId
      });
      setExistingSubmission(res.data.data.submission);
      addToast('success', 'Assignment submitted to instructor successfully!');
      fetchWorkspace(true);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to submit assignment');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  // Mark Video/Content Lesson Complete
  const handleMarkComplete = async () => {
    if (!activeItem || activeItem.type !== 'lesson') return;

    const isVideoLesson = Boolean(activeItem.videoUrl && activeItem.videoUrl.trim() !== '');
    if (isVideoLesson && !activeStatus.isCompleted && !hasVideoReachedEnd) {
      addToast('warning', 'You must watch 100% of the video before marking the lesson as complete.');
      return;
    }

    setSubmittingComplete(true);
    try {
      const res = await completeSubSection({
        trainingAssignmentId: assignmentId,
        subSectionId: activeItem.id,
        videoProgress: isVideoLesson ? 100 : undefined
      });
      addToast('success', 'Lesson completed!');
      await fetchWorkspace(true);

      const allItems = extractSyllabusItems(data);
      const currIdx = allItems.findIndex(i => i.id === activeItem.id && i.type === activeItem.type);
      if (currIdx >= 0 && currIdx < allItems.length - 1) {
        setActiveItem(allItems[currIdx + 1]);
      } else if (res.data.data.percentage === 100) {
        setActiveItem({ type: 'completed' });
      }
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to mark lesson complete');
    } finally {
      setSubmittingComplete(false);
    }
  };

  // Custom Video Player Controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || 0;
      setDuration(dur);

      if (dur > 0 && (videoRef.current.ended || cur >= dur - 0.5)) {
        setCurrentTime(dur);
        setMaxWatchedTime(dur);
        setHasVideoReachedEnd(true);
      } else {
        setCurrentTime(cur);
        setMaxWatchedTime(prevMax => Math.max(prevMax, cur));
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (videoRef.current && videoRef.current.duration) {
      const dur = videoRef.current.duration;
      setCurrentTime(dur);
      setMaxWatchedTime(dur);
      setHasVideoReachedEnd(true);
    }
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      const dur = videoRef.current.duration || duration || 0;

      // Allow unrestricted seeking for already completed video lessons
      if (activeStatus.isCompleted) {
        if (dur > 0 && time >= dur - 0.25) {
          videoRef.current.currentTime = dur;
          setCurrentTime(dur);
        } else {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
        return;
      }

      // For uncompleted video lesson: restrict forward seeking past unwatched portion
      if (time > maxWatchedTime + 0.5) {
        const allowed = Math.min(time, maxWatchedTime);
        videoRef.current.currentTime = allowed;
        setCurrentTime(allowed);
        addToast('warning', 'Forward seeking is disabled until you watch the full video.');
        return;
      }

      if (dur > 0 && time >= dur - 0.25) {
        videoRef.current.currentTime = dur;
        setCurrentTime(dur);
      } else {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  const handleSeeking = () => {
    if (!videoRef.current) return;
    if (activeStatus.isCompleted) return;

    if (videoRef.current.currentTime > maxWatchedTime + 0.5) {
      videoRef.current.currentTime = maxWatchedTime;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else setIsMuted(false);
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatVideoTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading || !data) return <LoadingSpinner text="Initializing training workspace..." />;

  const { assignment, progress } = data;
  const training = assignment.trainingId;
  const allItems = extractSyllabusItems(data);
  const allCourseResources = extractAllCourseResources(data);

  const currentIdx = allItems.findIndex(i => activeItem && i.id === activeItem.id && i.type === activeItem.type);
  const activeStatus = activeItem ? getItemStatus(activeItem) : { isCompleted: false, isLocked: false };

  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx >= 0 && currentIdx < allItems.length - 1 && activeStatus.isCompleted;

  const completedCount = allItems.filter(item => getItemStatus(item).isCompleted).length;
  const totalItemsCount = allItems.length;
  const calculatedPercentage = totalItemsCount > 0
    ? (completedCount === totalItemsCount ? 100 : Math.round((completedCount / totalItemsCount) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/employee/my-trainings')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[11px] font-bold text-emerald-700">
              {training.categoryId?.name || 'Course Training'}
            </span>
            <h1 className="text-lg font-extrabold text-slate-900 line-clamp-1 font-heading">{training.title}</h1>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-700">
              {calculatedPercentage}% Completed
            </p>
            <p className="text-[11px] text-slate-500 flex items-center justify-end">
              <Clock className="w-3 h-3 mr-1 text-slate-400" /> Due: {formatDate(assignment.deadline)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Layout (Left Content Player, Right Syllabus & Resources Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT / MAIN LEARNING AREA */}
        <div className="lg:col-span-2 space-y-4">

          {/* LOCKED ASSIGNMENT SCREEN */}
          {assignment.lockStatus?.isLocked || assignment.status === 'Locked' ? (
            <div className="bg-white p-8 sm:p-12 rounded-2xl border border-rose-200 text-center space-y-6 animate-scale-up shadow-xs">
              <div className="w-20 h-20 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-extrabold border border-rose-200">
                  🔒 Training Temporarily Locked
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Access Suspended
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  This training module has been temporarily locked by your instructor. Please contact your instructor or administrator to request access.
                </p>
                {assignment.lockStatus?.lockedReason && (
                  <p className="text-xs text-rose-600 italic pt-1">
                    Reason: "{assignment.lockStatus.lockedReason}"
                  </p>
                )}
              </div>
              <div className="pt-4">
                <button
                  onClick={() => navigate('/employee/my-trainings')}
                  className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Back to Assigned Trainings
                </button>
              </div>
            </div>
          ) : activeItem?.type === 'completed' ? (
            <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-6 animate-scale-up">
              <div className="w-20 h-20 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xs">
                <Award className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200">
                  🎉 Course 100% Completed
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Congratulations!
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  You have successfully finished all required lessons, quizzes, and assignments for <strong>"{training.title}"</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-xs pt-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Progress</p>
                  <p className="text-lg font-black text-emerald-700">100%</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Quiz Status</p>
                  <p className="text-lg font-black text-emerald-700">Passed ✓</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Assignment</p>
                  <p className="text-lg font-black text-teal-700">{data.assignmentSubmissions?.length ? 'Submitted ✓' : 'Completed'}</p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate('/employee/my-trainings')}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  Back to Assigned Trainings
                </button>
              </div>
            </div>
          ) : activeItem?.type === 'lesson' ? (
            /* LESSON VIEW (VIDEO / CONTENT) */
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">{activeItem.sectionTitle}</span>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center">
                    {activeItem.videoUrl ? <PlayCircle className="w-5 h-5 text-emerald-600 mr-2" /> : <FileText className="w-5 h-5 text-emerald-600 mr-2" />}
                    {activeItem.title}
                  </h2>
                </div>
                {activeStatus.isCompleted && (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completed
                  </span>
                )}
              </div>

              {/* VIDEO PLAYER */}
              {activeItem.videoUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-800 group">
                  {videoError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950 text-slate-300">
                      <AlertTriangle className="w-10 h-10 text-amber-500" />
                      <h4 className="font-bold text-sm text-white">Unable to Load Training Video</h4>
                      <p className="text-xs text-slate-400 max-w-sm">The media server was unable to stream this video file. Please check your network connection or ask your instructor to update the video.</p>
                      <button
                        onClick={() => {
                          setVideoError(false);
                          if (videoRef.current) {
                            videoRef.current.load();
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all cursor-pointer"
                      >
                        Retry Playback
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        src={formatMediaUrl(activeItem.videoUrl)}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleVideoEnded}
                        onSeeking={handleSeeking}
                        onError={() => setVideoError(true)}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={togglePlay}
                      />

                      {/* Video Overlay Controls Bar */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent space-y-2 opacity-90 transition-opacity">
                        <div className="relative w-full flex items-center group/timeline">
                          <div className="w-full bg-slate-800/80 h-1.5 rounded-lg overflow-hidden relative">
                            <div
                              className="bg-emerald-500 h-full rounded-lg transition-all duration-75"
                              style={{
                                width: `${
                                  duration > 0
                                    ? (currentTime >= duration || (videoRef.current && videoRef.current.ended)
                                      ? 100
                                      : Math.min(100, Math.round((currentTime / duration) * 100)))
                                    : 0
                                }%`
                              }}
                            />
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-4"
                          />
                        </div>

                        <div className="flex items-center justify-between text-white text-xs">
                          <div className="flex items-center space-x-3">
                            <button onClick={togglePlay} className="p-1 hover:text-emerald-400 transition-colors cursor-pointer">
                              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            </button>

                            <span className="font-mono text-[11px]">
                              {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
                            </span>

                            <div className="flex items-center space-x-1">
                              <button onClick={toggleMute} className="p-1 hover:text-emerald-400 cursor-pointer">
                                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                              </button>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.1}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-16 accent-emerald-500 h-1 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1 font-mono text-[10px]">
                              {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                                <button
                                  key={speed}
                                  onClick={() => handleSpeedChange(speed)}
                                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                    playbackSpeed === speed ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {speed}x
                                </button>
                              ))}
                            </div>

                            <button onClick={toggleFullscreen} className="p-1 hover:text-emerald-400 cursor-pointer">
                              <Maximize className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {/* LESSON NOTES / TEXT CONTENT */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-xs text-slate-700">Lesson Description</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeItem.description || 'Watch the video lesson and complete the interactive materials.'}
                </p>
              </div>
            </div>
          ) : activeItem?.type === 'quiz' ? (
            /* INTEGRATED QUIZ VIEW */
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              {!quizData ? (
                <LoadingSpinner text="Loading section quiz..." />
              ) : quizSubmitted && quizResult ? (
                /* QUIZ RESULT SCREEN */
                <div className="space-y-6">
                  <div className={`p-6 rounded-2xl border text-center space-y-2 ${
                    quizResult.passed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      quizResult.passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {quizResult.passed ? '✓ PASSED' : '✕ FAILED'}
                    </span>
                    <h3 className="text-2xl font-black">{quizResult.percentage}% Score</h3>
                    <p className="text-xs opacity-90">
                      Passing Score Required: <strong>{quizResult.passingScorePercent}%</strong>
                    </p>
                    {!quizResult.passed && (
                      <p className="text-xs pt-2 font-bold text-rose-700">
                        ✕ You did not pass this quiz. Please retake to unlock subsequent content.
                      </p>
                    )}
                  </div>

                  {/* QUESTION-LEVEL REVIEW */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Question Performance Breakdown</h4>
                    {quizResult.evaluatedAnswers?.map((ans, idx) => {
                      const userAnsText = ans.selectedAnswerText || (ans.options && ans.selectedOptionIndex !== null && ans.selectedOptionIndex !== undefined ? ans.options[ans.selectedOptionIndex] : (ans.status === 'data_unavailable' ? 'Answer data unavailable' : 'Not Answered'));
                      const corrAnsText = ans.correctAnswerText || (ans.options && ans.correctAnswerIndex !== null && ans.correctAnswerIndex !== undefined ? ans.options[ans.correctAnswerIndex] : 'N/A');
                      const isUnanswered = (ans.selectedOptionIndex === null || ans.selectedOptionIndex === undefined) && (!ans.selectedAnswerText || !ans.selectedAnswerText.trim());

                      return (
                        <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">Question {idx + 1}: {ans.questionText}</span>
                            <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
                              ans.isCorrect
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isUnanswered
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {ans.isCorrect ? '✓ Correct' : isUnanswered ? '○ Not Answered' : '✕ Incorrect'}
                            </span>
                          </div>
                          <p className="text-slate-500">Your Answer: <strong className={ans.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>{userAnsText || 'Not Answered'}</strong></p>
                          {!ans.isCorrect && (
                            <p className="text-slate-500">Correct Answer: <strong className="text-emerald-700">{corrAnsText}</strong></p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 text-center">
                    {!quizResult.passed ? (
                      <button
                        onClick={() => {
                          setQuizSubmitted(false);
                          setQuizResult(null);
                          setQuizStarted(false);
                          setQuizTimeRemaining(null);
                          setSelectedAnswers({});
                          setCurrentQuestionIdx(0);
                        }}
                        className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                      >
                        Retake Quiz
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (canGoNext) setActiveItem(allItems[currentIdx + 1]);
                        }}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                      >
                        Continue Learning →
                      </button>
                    )}
                  </div>
                </div>
              ) : !quizStarted && !quizSubmitted ? (
                /* QUIZ INTRODUCTION / DETAILS SCREEN */
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider">
                      Quiz Assessment
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900 mt-2.5 font-heading">
                      {quizData.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Test your knowledge on key concepts from this section. Complete all questions before submitting or before the timer runs out.
                    </p>
                  </div>

                  {/* STATS & METRICS GRID */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <HelpCircle className="w-5 h-5 mx-auto text-amber-600" />
                      <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Questions</span>
                      <strong className="block text-base font-extrabold text-slate-900">
                        {quizData.questions?.length || 0}
                      </strong>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <Clock className="w-5 h-5 mx-auto text-emerald-600" />
                      <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Duration</span>
                      <strong className="block text-base font-extrabold text-slate-900">
                        {quizData.timeLimitMinutes || 15} Min{quizData.timeLimitMinutes === 1 ? '' : 's'}
                      </strong>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <Award className="w-5 h-5 mx-auto text-emerald-600" />
                      <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Passing Score</span>
                      <strong className="block text-base font-extrabold text-slate-900">
                        {quizData.passingScorePercent || 50}%
                      </strong>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <RotateCcw className="w-5 h-5 mx-auto text-teal-600" />
                      <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Attempts</span>
                      <strong className="block text-base font-extrabold text-slate-900">
                        Unlimited
                      </strong>
                    </div>
                  </div>

                  {/* INSTRUCTIONS BOX */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2 text-emerald-950">
                    <h4 className="font-extrabold flex items-center">
                      <Sparkles className="w-4 h-4 mr-1.5 text-emerald-600" /> Important Instructions:
                    </h4>
                    <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
                      <li>The timer will start immediately when you click <strong>Start Quiz</strong>.</li>
                      <li>You can navigate between questions freely using Previous / Next buttons.</li>
                      <li>If the timer reaches 00:00, your selected answers will be automatically submitted.</li>
                      <li>You must achieve at least {quizData.passingScorePercent}% to pass the quiz.</li>
                    </ul>
                  </div>

                  {/* START QUIZ BUTTON */}
                  <div className="pt-2 text-center">
                    <button
                      onClick={handleStartQuiz}
                      disabled={startingQuiz}
                      className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs cursor-pointer transition-all disabled:opacity-50"
                    >
                      {startingQuiz ? 'Initializing Quiz...' : 'Start Quiz →'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ACTIVE QUIZ QUESTIONNAIRE */
                <div className={quizStarted && !quizSubmitted ? "fixed inset-0 z-[9999] bg-slate-50 flex flex-col" : "space-y-6"}>
                  {quizStarted && !quizSubmitted && quizPaused ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white animate-fade-in">
                      <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center border border-rose-200 mb-6 shadow-sm">
                        <AlertTriangle className="w-12 h-12 text-rose-500" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Quiz Paused</h2>
                      <p className="text-lg text-rose-700 font-bold max-w-lg text-center leading-relaxed mb-8">
                        {violationWarning}
                      </p>
                      <button
                        onClick={returnToFocusMode}
                        className="px-10 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg transition-all cursor-pointer shadow-xl hover:shadow-emerald-500/30"
                      >
                        Return to Focus Mode
                      </button>
                    </div>
                  ) : quizStarted && !quizSubmitted ? (
                    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 sm:p-6 gap-6">
                      {/* FOCUS MODE HEADER */}
                      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100">
                            <Lock className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                                Focus Mode Active
                              </span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mt-1">{quizData.title}</h2>
                          </div>
                        </div>
                        
                        {quizTimeRemaining !== null && (
                          <div className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-mono text-lg font-bold shadow-md flex items-center">
                            <Clock className="w-5 h-5 mr-2 text-emerald-400" />
                            {formatVideoTime(quizTimeRemaining)}
                          </div>
                        )}

                        <div className="flex-1 flex justify-end">
                          <button
                            onClick={() => submitQuizAnswers(false)}
                            disabled={submittingQuiz}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md cursor-pointer transition-all flex items-center"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {submittingQuiz ? 'Evaluating...' : 'Submit Quiz'}
                          </button>
                        </div>
                      </div>

                      {/* TWO COLUMN LAYOUT */}
                      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                        {/* LEFT COLUMN: QUESTION CARD */}
                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 overflow-y-auto flex flex-col">
                          {quizData.questions && quizData.questions.length > 0 && (() => {
                            const currentQ = quizData.questions[currentQuestionIdx];
                            const qType = currentQ.questionType || (currentQ.options && currentQ.options.length > 0 ? 'MCQ' : 'FILL_IN_BLANK');

                            return (
                              <div className="flex flex-col h-full">
                                <div className="flex justify-between items-center text-sm font-bold text-slate-700 pb-4 border-b border-slate-100 mb-6">
                                  <span>Question {currentQuestionIdx + 1} of {quizData.questions.length}</span>
                                  <span className="px-3 py-1 rounded bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 border border-slate-200">
                                    {qType === 'TRUE_FALSE' ? 'True / False' : qType === 'FILL_IN_BLANK' ? 'Fill in the Blank' : 'Multiple Choice'}
                                  </span>
                                </div>

                                <div className="flex-1 space-y-8">
                                  <h3 className="font-bold text-slate-900 text-xl leading-relaxed">
                                    {currentQ.questionText}
                                  </h3>

                                  {/* Choice Options */}
                                  {qType === 'MCQ' && (
                                    <div className="space-y-3">
                                      {currentQ.options?.map((opt, optIdx) => (
                                        <label
                                          key={optIdx}
                                          className={`flex items-center p-4 rounded-xl border-2 text-sm cursor-pointer transition-all ${
                                            selectedAnswers[currentQuestionIdx] === optIdx
                                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-sm'
                                              : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                                            selectedAnswers[currentQuestionIdx] === optIdx ? 'border-emerald-500' : 'border-slate-300'
                                          }`}>
                                            {selectedAnswers[currentQuestionIdx] === optIdx && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                                          </div>
                                          <input
                                            type="radio"
                                            name={`q_${currentQuestionIdx}`}
                                            checked={selectedAnswers[currentQuestionIdx] === optIdx}
                                            onChange={() => setSelectedAnswers({ ...selectedAnswers, [currentQuestionIdx]: optIdx })}
                                            className="hidden"
                                          />
                                          <span className="leading-relaxed">{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {qType === 'TRUE_FALSE' && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAnswers({ ...selectedAnswers, [currentQuestionIdx]: 0 })}
                                        className={`p-6 rounded-xl border-2 text-base font-bold cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                                          selectedAnswers[currentQuestionIdx] === 0
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className="text-2xl">✓</span>
                                        <span>True</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAnswers({ ...selectedAnswers, [currentQuestionIdx]: 1 })}
                                        className={`p-6 rounded-xl border-2 text-base font-bold cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                                          selectedAnswers[currentQuestionIdx] === 1
                                            ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className="text-2xl">✕</span>
                                        <span>False</span>
                                      </button>
                                    </div>
                                  )}

                                  {qType === 'FILL_IN_BLANK' && (
                                    <div className="space-y-3">
                                      <input
                                        type="text"
                                        value={selectedAnswers[currentQuestionIdx] !== undefined && selectedAnswers[currentQuestionIdx] !== null ? selectedAnswers[currentQuestionIdx] : ''}
                                        onChange={(e) => setSelectedAnswers({ ...selectedAnswers, [currentQuestionIdx]: e.target.value })}
                                        placeholder="Type your answer here..."
                                        className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                                      disabled={currentQuestionIdx === 0}
                                      className="px-6 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    >
                                      ← Previous
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        setMarkedForReview(prev => ({
                                          ...prev,
                                          [currentQuestionIdx]: !prev[currentQuestionIdx]
                                        }));
                                      }}
                                      className={`px-4 py-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors flex items-center ${
                                        markedForReview[currentQuestionIdx]
                                          ? 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100'
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="mr-2">🚩</span>
                                      {markedForReview[currentQuestionIdx] ? 'Marked for Review' : 'Mark for Review'}
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => setCurrentQuestionIdx(prev => Math.min(quizData.questions.length - 1, prev + 1))}
                                    disabled={currentQuestionIdx === quizData.questions.length - 1}
                                    className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-md"
                                  >
                                    Next →
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* RIGHT COLUMN: QUESTION NAVIGATOR */}
                        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-y-auto">
                          <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider mb-6 pb-4 border-b border-slate-100">
                            Question Navigator
                          </h3>
                          
                          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2 mb-8">
                            {quizData.questions?.map((_, idx) => {
                              const isAnswered = selectedAnswers[idx] !== undefined && selectedAnswers[idx] !== null && selectedAnswers[idx] !== '';
                              const isCurrent = idx === currentQuestionIdx;
                              const isReview = markedForReview[idx];
                              
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setCurrentQuestionIdx(idx)}
                                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold border-2 cursor-pointer transition-all ${
                                    isCurrent
                                      ? 'border-slate-900 bg-slate-900 text-white shadow-md transform scale-110'
                                      : isReview
                                      ? 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                      : isAnswered
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  {idx + 1}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-auto space-y-3 pt-6 border-t border-slate-100 text-xs font-semibold text-slate-600">
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-50"></div>
                              <span>Answered</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4 rounded border-2 border-slate-200 bg-white"></div>
                              <span>Unanswered</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50 text-center leading-[14px]">🚩</div>
                              <span>Review</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4 rounded border-2 border-slate-900 bg-slate-900"></div>
                              <span>Current</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p>Something went wrong. Please refresh the page.</p>
                    </div>
                  )}
                </div>
        )}
      </div>
    ) : activeItem?.type === 'assignment' ? (
            /* INTEGRATED ASSIGNMENT VIEW */
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              {!assignmentDetails ? (
                <LoadingSpinner text="Loading assignment requirements..." />
              ) : (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="text-[11px] font-bold text-teal-700">Course Project Assignment</span>
                    <h2 className="text-lg font-bold text-slate-900">{assignmentDetails.title}</h2>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-900">Project Instructions & Requirements:</h4>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{assignmentDetails.instructions}</p>
                  </div>

                  {/* Submission Form */}
                  <form onSubmit={handleAssignmentSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">Select Submission Format (Choose EITHER GitHub OR File Upload)</label>
                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setSubmissionType('github')}
                          className={`flex-1 p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                            submissionType === 'github'
                              ? 'bg-teal-50 border-teal-300 text-teal-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Code2 className="w-4 h-4" />
                          <span>Option 1: GitHub Repository Link</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubmissionType('file')}
                          className={`flex-1 p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                            submissionType === 'file'
                              ? 'bg-teal-50 border-teal-300 text-teal-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Upload className="w-4 h-4" />
                          <span>Option 2: File Upload</span>
                        </button>
                      </div>
                    </div>

                    {submissionType === 'github' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          GitHub Repository URL <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          required
                          placeholder="https://github.com/username/repository"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 outline-none focus:border-teal-600"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Upload Assignment File / PDF <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center space-x-3">
                          <label className="cursor-pointer inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700">
                            <Upload className="w-4 h-4 mr-1.5" />
                            {uploadingFile ? 'Uploading...' : 'Choose File'}
                            <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploadingFile} />
                          </label>
                          {uploadedFileUrl && <span className="text-xs text-emerald-700 font-mono font-bold truncate max-w-xs">{uploadedFileUrl}</span>}
                        </div>
                      </div>
                    )}

                    {existingSubmission && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center text-slate-900">
                            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                            Assignment Submitted
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            existingSubmission.status === 'reviewed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {existingSubmission.status === 'reviewed' ? '✓ Reviewed' : 'Pending Review'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500">
                          Submitted on: {formatDate(existingSubmission.submittedAt)}
                        </p>

                        {existingSubmission.status === 'reviewed' ? (
                          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 space-y-1.5 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">Instructor Grade:</span>
                              <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[11px] bg-teal-600 text-white shadow-xs">
                                {existingSubmission.grade || 'Good'}
                              </span>
                            </div>
                            {existingSubmission.feedback && (
                              <div>
                                <span className="font-bold text-slate-700 text-[11px]">Instructor Feedback:</span>
                                <p className="text-slate-600 italic pt-0.5">{existingSubmission.feedback}</p>
                              </div>
                            )}
                            {existingSubmission.reviewedAt && (
                              <p className="text-[10px] text-slate-400 font-mono pt-1">
                                Reviewed on: {formatDate(existingSubmission.reviewedAt)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                            Grade & Feedback: <strong>Pending instructor review</strong>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingAssignment || uploadingFile}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                      >
                        {submittingAssignment ? 'Submitting...' : existingSubmission ? 'Update Submission' : 'Submit Assignment'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : null}

          {/* FIXED BOTTOM NAVIGATION BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <button
              onClick={() => {
                if (canGoPrev) setActiveItem(allItems[currentIdx - 1]);
              }}
              disabled={!canGoPrev}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </button>

            {/* Mark as Complete (Show ONLY for Video/Content Lessons) */}
            {activeItem?.type === 'lesson' && (() => {
              const isVideoLesson = Boolean(activeItem.videoUrl && activeItem.videoUrl.trim() !== '');
              const isVideoIncomplete = isVideoLesson && !activeStatus.isCompleted && !hasVideoReachedEnd;
              const isBtnDisabled = activeStatus.isCompleted || submittingComplete || isVideoIncomplete;

              return (
                <button
                  onClick={handleMarkComplete}
                  disabled={isBtnDisabled}
                  className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center ${
                    activeStatus.isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default font-bold'
                      : isVideoIncomplete
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {activeStatus.isCompleted
                    ? '✓ Completed'
                    : submittingComplete
                    ? 'Updating...'
                    : isVideoIncomplete
                    ? 'Watch Video to Complete'
                    : 'Mark as Complete'}
                </button>
              );
            })()}

            <button
              onClick={() => {
                if (canGoNext) {
                  setActiveItem(allItems[currentIdx + 1]);
                } else if (currentIdx === allItems.length - 1 && activeStatus.isCompleted) {
                  setActiveItem({ type: 'completed' });
                }
              }}
              disabled={!canGoNext && !(currentIdx === allItems.length - 1 && activeStatus.isCompleted)}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 disabled:bg-slate-200 cursor-pointer shadow-xs"
            >
              {currentIdx === allItems.length - 1 && activeStatus.isCompleted ? (
                <>
                  Finish Training <Sparkles className="w-4 h-4 ml-1.5 text-amber-300" />
                </>
              ) : (
                <>
                  Continue Learning <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT SIDEBAR: COURSE CONTENTS / SYLLABUS & RESOURCES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between max-h-[85vh] overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-heading">Course Contents</h3>

              {/* Progress Summary */}
              <div className="space-y-1.5 pt-3">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Progress: {completedCount} / {totalItemsCount} completed</span>
                  <span className="text-emerald-700">{calculatedPercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${calculatedPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Modules & Content Items Tree */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {training.sections?.map((sec, sIdx) => (
                <div key={sec._id || sIdx} className="space-y-2">
                  <h4 className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    MODULE {sIdx + 1}: {sec.title}
                  </h4>

                  <div className="space-y-1">
                    {allItems
                      .filter(item => item.sectionTitle === sec.title && item.type !== 'assignment')
                      .map((item) => {
                        const status = getItemStatus(item);
                        const isCurrent = activeItem && activeItem.id === item.id && activeItem.type === item.type;

                        return (
                          <button
                            key={`${item.type}_${item.id}`}
                            onClick={() => {
                              if (!status.isLocked) setActiveItem(item);
                            }}
                            disabled={status.isLocked}
                            className={`w-full text-left p-3 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                : status.isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                                : status.isLocked
                                ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed border border-slate-200'
                                : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              {status.isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              ) : isCurrent ? (
                                <PlayCircle className="w-4 h-4 text-white flex-shrink-0" />
                              ) : status.isLocked ? (
                                <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              ) : item.type === 'quiz' ? (
                                <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              ) : (
                                <PlayCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              )}
                              <span className="truncate">{item.title}</span>
                            </div>

                            <span className="text-[10px] opacity-75 font-semibold">
                              {status.isCompleted ? '✓' : status.isLocked ? '🔒' : isCurrent ? '▶' : '○'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}

              {/* DEDICATED ASSIGNMENT AT VERY END OF ALL MODULES */}
              {allItems.find(item => item.type === 'assignment') && (() => {
                const assignmentItem = allItems.find(item => item.type === 'assignment');
                const status = getItemStatus(assignmentItem);
                const isCurrent = activeItem && activeItem.id === assignmentItem.id && activeItem.type === 'assignment';

                return (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <h4 className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                      COURSE ASSIGNMENT
                    </h4>
                    <button
                      key={`${assignmentItem.type}_${assignmentItem.id}`}
                      onClick={() => {
                        if (!status.isLocked) setActiveItem(assignmentItem);
                      }}
                      disabled={status.isLocked}
                      className={`w-full text-left p-3 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-teal-600 text-white font-bold shadow-xs'
                          : status.isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                          : status.isLocked
                          ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed border border-slate-200'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        {status.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : isCurrent ? (
                          <FileCheck2 className="w-4 h-4 text-white flex-shrink-0" />
                        ) : status.isLocked ? (
                          <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        ) : (
                          <FileCheck2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        )}
                        <span className="truncate">{assignmentItem.title}</span>
                      </div>

                      <span className="text-[10px] opacity-75 font-semibold">
                        {status.isCompleted ? '✓' : status.isLocked ? '🔒' : isCurrent ? '▶' : '○'}
                      </span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* RESOURCES AT BOTTOM OF SIDEBAR */}
          {allCourseResources.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center">
                <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> RESOURCES
              </h4>
              <div className="space-y-2">
                {allCourseResources.map((res, rIdx) => (
                  <div key={rIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="truncate pr-2">
                      <p className="font-bold text-slate-900 truncate">{res.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{res.lessonTitle}</p>
                    </div>
                    <a
                      href={formatMediaUrl(res.fileUrl || res.pdfUrl || res.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-100 cursor-pointer inline-flex items-center text-[11px] flex-shrink-0"
                    >
                      <Download className="w-3 h-3 mr-1" /> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
