import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrainings,
  getDepartments,
  getCategories,
  getMyAssignments,
  getAutoRules,
  getAdminDashboardReports,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteTraining,
  createAutoRule,
  deactivateAutoRule,
  reactivateAutoRule
} from '../services/api';

export const LMS_QUERY_KEYS = {
  TRAININGS: ['trainings'],
  DEPARTMENTS: ['departments'],
  CATEGORIES: ['categories'],
  MY_ASSIGNMENTS: ['my-assignments'],
  AUTO_RULES: ['auto-rules'],
  ADMIN_DASHBOARD: ['admin-dashboard']
};

/**
 * Custom Query Hooks
 */
export const useTrainingsQuery = (options = {}) => {
  return useQuery({
    queryKey: LMS_QUERY_KEYS.TRAININGS,
    queryFn: async () => {
      const res = await getTrainings();
      return res.data?.data?.trainings || [];
    },
    ...options
  });
};

export const useDepartmentsQuery = (options = {}) => {
  return useQuery({
    queryKey: LMS_QUERY_KEYS.DEPARTMENTS,
    queryFn: async () => {
      const res = await getDepartments();
      return res.data?.data?.departments || [];
    },
    ...options
  });
};

export const useCategoriesQuery = (options = {}) => {
  return useQuery({
    queryKey: LMS_QUERY_KEYS.CATEGORIES,
    queryFn: async () => {
      const res = await getCategories();
      return res.data?.data?.categories || [];
    },
    ...options
  });
};

export const useMyAssignmentsQuery = (options = {}) => {
  return useQuery({
    queryKey: LMS_QUERY_KEYS.MY_ASSIGNMENTS,
    queryFn: async () => {
      const res = await getMyAssignments();
      return res.data?.data?.assignments || [];
    },
    ...options
  });
};

export const useAutoRulesQuery = (options = {}) => {
  return useQuery({
    queryKey: LMS_QUERY_KEYS.AUTO_RULES,
    queryFn: async () => {
      const res = await getAutoRules();
      return res.data?.data?.rules || [];
    },
    ...options
  });
};

export const useAdminDashboardQuery = (options = {}) => {
  return useQuery({
    queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD,
    queryFn: async () => {
      const res = await getAdminDashboardReports();
      return res.data?.data || null;
    },
    ...options
  });
};

/**
 * Mutation Hooks with Automatic Query Invalidation
 */
export const useDepartmentMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.DEPARTMENTS });
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.DEPARTMENTS });
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.DEPARTMENTS });
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD });
    }
  });

  return { createMutation, updateMutation, deleteMutation };
};

export const useCategoryMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.CATEGORIES });
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.CATEGORIES });
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.CATEGORIES });
      queryClient.invalidateQueries({ queryKey: LMS_QUERY_KEYS.ADMIN_DASHBOARD });
    }
  });

  return { createMutation, updateMutation, deleteMutation };
};

export const useInvalidateLmsQueries = () => {
  const queryClient = useQueryClient();
  return (keys = []) => {
    if (keys.length === 0) {
      queryClient.invalidateQueries();
    } else {
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
    }
  };
};
