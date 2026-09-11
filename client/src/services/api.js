import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL;

const getBaseUrl = () => {
  if (!rawApiUrl) return '/api';
  const cleanUrl = rawApiUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// In-flight GET request deduplicator and short-lived client-side response cache
const pendingGetRequests = new Map();
const responseCache = new Map();
const DEFAULT_TTL = 10000; // 10 seconds memory TTL

export const clearApiCache = (url = '') => {
  if (url && (url.includes('/notifications') || url.includes('/progress') || url.includes('/status') || url.includes('/auto-rules'))) {
    return; // Do not clear general entity cache for notification reads, progress pings, user status updates, or auto-rule toggles
  }
  responseCache.clear();
};

const originalGet = api.get.bind(api);
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);
const originalDelete = api.delete.bind(api);

api.post = function (url, data, config) {
  clearApiCache(url);
  return originalPost(url, data, config);
};

api.put = function (url, data, config) {
  clearApiCache(url);
  return originalPut(url, data, config);
};

api.delete = function (url, config) {
  clearApiCache(url);
  return originalDelete(url, config);
};

api.get = function (url, config = {}) {
  const bypassCache = config && config.skipCache;
  const key = url + (config && config.params ? JSON.stringify(config.params) : '');

  const now = Date.now();
  if (!bypassCache && responseCache.has(key)) {
    const cached = responseCache.get(key);
    if (now - cached.timestamp < DEFAULT_TTL) {
      return Promise.resolve({
        ...cached.response,
        data: JSON.parse(JSON.stringify(cached.response.data))
      });
    } else {
      responseCache.delete(key);
    }
  }

  if (pendingGetRequests.has(key)) {
    return pendingGetRequests.get(key).then(res => ({
      ...res,
      data: JSON.parse(JSON.stringify(res.data))
    }));
  }

  const requestPromise = originalGet(url, config).then(res => {
    if (!bypassCache && res.status >= 200 && res.status < 300) {
      responseCache.set(key, {
        timestamp: Date.now(),
        response: res
      });
    }
    return res;
  }).finally(() => {
    pendingGetRequests.delete(key);
  });

  pendingGetRequests.set(key, requestPromise);
  return requestPromise;
};

// Auth APIs
export const setupOrg = (data) => api.post('/auth/setup-org', data);
export const registerEmployee = (data) => api.post('/auth/register-employee', data);
export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const logoutUser = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (data) => api.put('/auth/change-password', data);
export const updateProfilePicture = (formData) => api.put('/auth/profile-picture', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const resetProfilePicture = () => api.delete('/auth/profile-picture');
export const requestForgotPasswordOTP = (data) => api.post('/auth/forgot-password', data);
export const verifyForgotPasswordOTP = (data) => api.post('/auth/verify-otp', data);
export const resetPasswordWithOTP = (data) => api.post('/auth/reset-password', data);

// Org & Department & Users APIs
export const getDepartments = () => api.get('/org/departments');
export const createDepartment = (data) => api.post('/org/departments', data);
export const updateDepartment = (id, data) => api.put(`/org/departments/${id}`, data);
export const deleteDepartment = (id) => api.delete(`/org/departments/${id}`);

export const getInstructors = () => api.get('/org/instructors');
export const createInstructor = (data) => api.post('/org/instructors', data);
export const createAdmin = (data) => api.post('/org/admins', data);
export const getEmployees = () => api.get('/org/employees');
export const updateOrgProfile = (data) => api.put('/org/profile', data);
export const updateUserStatus = (id, status) => api.put(`/org/users/${id}/status`, { status });

// Training Categories APIs
export const getCategories = () => api.get('/categories');
export const createCategory = (data) => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// Training Management APIs
export const getTrainings = () => api.get('/trainings');
export const getTrainingById = (id) => api.get(`/trainings/${id}`);
export const createTraining = (data) => api.post('/trainings', data);
export const saveFullCourse = (data) => api.post('/trainings/save-full-course', data);
export const updateTraining = (id, data) => api.put(`/trainings/${id}`, data);
export const deleteTraining = (id) => api.delete(`/trainings/${id}`);

export const addSection = (trainingId, data) => api.post(`/trainings/${trainingId}/sections`, data);
export const updateSection = (trainingId, sectionId, data) => api.put(`/trainings/${trainingId}/sections/${sectionId}`, data);
export const deleteSection = (trainingId, sectionId) => api.delete(`/trainings/${trainingId}/sections/${sectionId}`);

export const addSubSection = (trainingId, sectionId, data) => api.post(`/trainings/${trainingId}/sections/${sectionId}/subsections`, data);
export const updateSubSection = (trainingId, sectionId, subSectionId, data) => api.put(`/trainings/${trainingId}/sections/${sectionId}/subsections/${subSectionId}`, data);
export const deleteSubSection = (trainingId, sectionId, subSectionId) => api.delete(`/trainings/${trainingId}/sections/${sectionId}/subsections/${subSectionId}`);

// Media Upload APIs
export const uploadImage = (formData) => api.post('/media/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const uploadVideo = (formData) => api.post('/media/upload-video', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const uploadPdf = (formData) => api.post('/media/upload-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteMedia = (publicId, resourceType) => api.post('/media/delete', { publicId, resourceType });

// Quiz APIs
export const createQuiz = (data) => api.post('/quizzes', data);
export const getQuizById = (id) => api.get(`/quizzes/${id}`);
export const startQuiz = (id, data) => api.post(`/quizzes/${id}/start`, data);
export const updateQuiz = (id, data) => api.put(`/quizzes/${id}`, data);
export const submitQuiz = (id, data) => api.post(`/quizzes/${id}/submit`, data);
export const reportQuizSecurityEvent = (id, data) => api.post(`/quizzes/${id}/security-event`, data);
export const getQuizAttempts = (id) => api.get(`/quizzes/${id}/attempts`);

// Assignment APIs
export const createAssignment = (data) => api.post('/assignments', data);
export const getAssignmentById = (id) => api.get(`/assignments/${id}`);
export const updateAssignment = (id, data) => api.put(`/assignments/${id}`, data);
export const submitAssignment = (id, data) => api.post(`/assignments/${id}/submit`, data);
export const getAssignmentSubmissions = (id) => api.get(id ? `/assignments/${id}/submissions` : '/assignments/instructor-submissions');
export const getInstructorSubmissions = (trainingId) => api.get(`/assignments/instructor-submissions${trainingId && trainingId !== 'all' ? `?trainingId=${trainingId}` : ''}`);
export const reviewSubmission = (submissionId, data) => api.put(`/assignments/submissions/${submissionId}/review`, data);
export const getMyFeedback = () => api.get('/assignments/my-feedback');

// Training Assignment Engine APIs
export const assignTraining = (data) => api.post('/assignments-engine/assign', data);
export const createAutoRule = (data) => api.post('/assignments-engine/auto-rule', data);
export const getAutoRules = () => api.get('/assignments-engine/auto-rules');
export const deactivateAutoRule = (id) => api.put(`/assignments-engine/auto-rules/${id}/deactivate`);
export const reactivateAutoRule = (id) => api.put(`/assignments-engine/auto-rules/${id}/reactivate`);
export const getMyAssignments = () => api.get('/assignments-engine/my-assignments');
export const getAllAssignments = () => api.get('/assignments-engine/all');
export const extendDeadline = (assignmentId, data) => api.put(`/assignments-engine/${assignmentId}/extend-deadline`, data);
export const lockTraining = (assignmentId, data) => api.put(`/assignments-engine/${assignmentId}/lock`, data);
export const unlockTraining = (assignmentId) => api.put(`/assignments-engine/${assignmentId}/unlock`);

// Progress Tracking APIs
export const completeSubSection = (data) => api.post('/progress/complete-subsection', data);
export const getProgressByAssignment = (trainingAssignmentId) => api.get(`/progress/${trainingAssignmentId}`);

// Notifications APIs
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put('/notifications/read-all');

// Reports & Analytics APIs
export const getFullOrgReport = () => api.get('/reports/full-org-report');
export const getAdminDashboardReports = () => api.get('/reports/admin-dashboard');
export const getInstructorDashboardReports = () => api.get('/reports/instructor-dashboard');
export const getMyReport = () => api.get('/reports/my-report');
export const getEmployeeReport = (employeeId) => api.get(`/reports/employee/${employeeId}`);

// Audit Logs APIs
export const getAuditLogs = () => api.get('/audit-logs');

// Certificate APIs
export const getMyCertificates = () => api.get('/certificates/my-certificates');
export const getOrgCertificates = (params) => api.get('/certificates/org-certificates', { params });
export const getInstructorCertificates = () => api.get('/certificates/instructor-certificates');
export const getCertificateById = (id) => api.get(`/certificates/${id}`);
export const getCertificateTemplate = () => api.get('/certificates/template');
export const updateCertificateTemplate = (data) => api.put('/certificates/template', data);
export const resetCertificateTemplate = () => api.post('/certificates/template/reset');
export const getBackfillEligible = () => api.get('/certificates/backfill-eligible');
export const backfillCertificates = () => api.post('/certificates/backfill');

export default api;
