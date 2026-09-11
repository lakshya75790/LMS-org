/**
 * Utility for exporting real LMS reports to CSV format
 */

const downloadCSV = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportEmployeeProgressReport = (employees) => {
  let csv = 'Employee Name,Email,Department,Job Role,Total Assigned,Completed,In Progress,Pending,Overdue,Compliance Rate (%),Overall Progress (%)\n';
  employees.forEach(e => {
    csv += `"${e.name}","${e.email}","${e.departmentName || 'Unassigned'}","${e.jobRole || 'Unassigned'}",${e.totalAssigned},${e.completed},${e.inProgress},${e.pending},${e.overdue},${e.complianceRate},${e.overallProgress}\n`;
  });
  downloadCSV(`Employee_Progress_Report_${Date.now()}.csv`, csv);
};

export const exportDepartmentComplianceReport = (departments) => {
  let csv = 'Department Name,Total Employees,Total Roles,Total Assigned,Completed,In Progress,Pending,Overdue,Compliance Rate (%)\n';
  departments.forEach(d => {
    csv += `"${d.departmentName}",${d.totalEmployees},${d.totalRoles || 0},${d.totalAssigned},${d.completed},${d.inProgress},${d.pending},${d.overdue},${d.complianceRate}\n`;
  });
  downloadCSV(`Department_Compliance_Report_${Date.now()}.csv`, csv);
};

export const exportTrainingAnalyticsReport = (trainings) => {
  let csv = 'Training Course,Category,Mandatory,Total Assigned,Completed,In Progress,Pending,Overdue,Completion Rate (%),Avg Progress (%)\n';
  trainings.forEach(t => {
    csv += `"${t.title}","${t.categoryName || 'General'}",${t.isMandatory ? 'Yes' : 'No'},${t.totalAssigned},${t.completed},${t.inProgress},${t.pending},${t.overdue},${t.completionRate},${t.avgProgress}\n`;
  });
  downloadCSV(`Training_Completion_Report_${Date.now()}.csv`, csv);
};

export const exportOverdueReport = (overdueItems) => {
  let csv = 'Employee Name,Email,Department,Job Role,Training Course,Deadline,Days Overdue,Progress (%),Assigned By\n';
  overdueItems.forEach(o => {
    csv += `"${o.employeeName}","${o.employeeEmail}","${o.departmentName}","${o.jobRole}","${o.trainingTitle}","${new Date(o.deadline).toLocaleDateString()}",${o.daysOverdue},${o.currentProgress},"${o.assignedBy}"\n`;
  });
  downloadCSV(`Overdue_Trainings_Report_${Date.now()}.csv`, csv);
};

export const exportFullOrgReport = (data) => {
  let csv = '=== ORGANIZATIONAL SUMMARY ===\n';
  const ov = data.overview || {};
  csv += `Total Employees,${ov.totalEmployees || 0}\n`;
  csv += `Total Departments,${ov.totalDepartments || 0}\n`;
  csv += `Active Trainings,${ov.totalActiveTrainings || 0}\n`;
  csv += `Total Assignments,${ov.totalAssignments || 0}\n`;
  csv += `Completed Assignments,${ov.completedAssignments || 0}\n`;
  csv += `In Progress Assignments,${ov.inProgressAssignments || 0}\n`;
  csv += `Pending Assignments,${ov.pendingAssignments || 0}\n`;
  csv += `Overdue Assignments,${ov.overdueAssignments || 0}\n`;
  csv += `Overall Compliance Rate,${ov.overallComplianceRate || 0}%\n\n`;

  csv += '=== DEPARTMENT COMPLIANCE ===\n';
  csv += 'Department Name,Employees,Assigned,Completed,In Progress,Pending,Overdue,Compliance Rate (%)\n';
  (data.departmentAnalytics || []).forEach(d => {
    csv += `"${d.departmentName}",${d.totalEmployees},${d.totalAssigned},${d.completed},${d.inProgress},${d.pending},${d.overdue},${d.complianceRate}\n`;
  });

  csv += '\n=== EMPLOYEE PROGRESS ===\n';
  csv += 'Employee Name,Email,Department,Job Role,Assigned,Completed,In Progress,Pending,Overdue,Overall Progress (%)\n';
  (data.employeeAnalytics || []).forEach(e => {
    csv += `"${e.name}","${e.email}","${e.departmentName}","${e.jobRole}",${e.totalAssigned},${e.completed},${e.inProgress},${e.pending},${e.overdue},${e.overallProgress}\n`;
  });

  downloadCSV(`Full_LMS_Organization_Report_${Date.now()}.csv`, csv);
};
