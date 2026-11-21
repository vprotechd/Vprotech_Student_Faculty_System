
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/apiClient';
import MasterTimetable from '../components/admin/MasterTimetable';

type Employee = {
  _id: string;
  facultyId?: string;
  employeeId: string;
  designation: string;
  qualification?: string | null;
  specialization?: string | null;
  joiningDate?: string | null;
  departmentId?: {
    _id?: string;
    name?: string;
    code?: string;
  } | null;
  phone?: string | null;
  userId: {
    _id: string;
    name: string;
    email: string;
    isActive: boolean;
    mustChangePassword?: boolean;
  };
};

type Department = {
  _id: string;
  name: string;
  code?: string;
  isActive?: boolean;
};

type DashboardStats = {
  users: number;
  students: number;
  faculty: number;
  classes: number;
  openDoubts: number;
  activeSessions: number;
};

type ActiveUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActivityAt: string;
};

type EmployeeSchedule = {
  _id: string;
  title: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location: string;
  userId: {
    _id?: string;
    name: string;
    email: string;
  };
};

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [facultyList, setFacultyList] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);

  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingActiveUsers, setLoadingActiveUsers] = useState(false);

  /*
   * Keeps track of employees whose password was successfully
   * changed from this screen.
   *
   * This prevents the UI from showing "Temporary password pending"
   * again if the employee API response is temporarily stale.
   */
  const [passwordClearedEmployeeIds, setPasswordClearedEmployeeIds] =
    useState<Set<string>>(new Set());

  // ==========================================
  // SEARCH
  // ==========================================

  const [searchQuery, setSearchQuery] = useState('');

  // ==========================================
  // EMPLOYEE MODAL
  // ==========================================

  const [modalVisible, setModalVisible] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
    null
  );

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newQualification, setNewQualification] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newJoiningDate, setNewJoiningDate] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [showDepartmentOptions, setShowDepartmentOptions] = useState(false);

  // ==========================================
  // SCHEDULE MODAL
  // ==========================================

  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );

  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleFacultyEmail, setScheduleFacultyEmail] = useState('');
  const [scheduleDay, setScheduleDay] = useState('Monday');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');

  // ==========================================
  // DASHBOARD
  // ==========================================

  const fetchDashboard = useCallback(async () => {
    try {
      setLoadingOverview(true);

      const [dashboardResponse, sessionsResponse] = await Promise.all([
        API.get('/admin/dashboard'),
        API.get('/admin/active-sessions'),
      ]);

      const dashboardData = dashboardResponse.data?.data;

      if (!dashboardData || typeof dashboardData !== 'object') {
        throw new Error('The server returned invalid dashboard data.');
      }

      setStats({
        users: Number(dashboardData.users) || 0,
        students: Number(dashboardData.students) || 0,
        faculty: Number(dashboardData.faculty) || 0,
        classes: Number(dashboardData.classes) || 0,
        openDoubts: Number(dashboardData.openDoubts) || 0,
        activeSessions: Number(dashboardData.activeSessions) || 0,
      });

      if (!Array.isArray(sessionsResponse.data?.data)) {
        throw new Error('The server returned an invalid active-user list.');
      }

      setActiveUsers(sessionsResponse.data.data);
    } catch (error: any) {
      Alert.alert(
        'Could not load overview',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // ==========================================
  // ACTIVE USERS
  // ==========================================

  const fetchActiveUsers = useCallback(async () => {
    try {
      setLoadingActiveUsers(true);

      const response = await API.get('/admin/active-sessions');

      if (!Array.isArray(response.data?.data)) {
        throw new Error('The server returned an invalid active-user list.');
      }

      setActiveUsers(response.data.data);
    } catch (error: any) {
      Alert.alert(
        'Could not load active users',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoadingActiveUsers(false);
    }
  }, []);

  // ==========================================
  // EMPLOYEES
  // ==========================================

  const fetchEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);

      const response = await API.get('/admin/employees');

      if (!Array.isArray(response.data?.data)) {
        throw new Error('The server returned an invalid employee list.');
      }

      const serverEmployees: Employee[] = response.data.data;

      /*
       * Merge the server response with locally confirmed password changes.
       *
       * If the backend still returns mustChangePassword=true immediately
       * after a successful password update, the UI will not show the
       * "Temporary password pending" message again.
       */
      const updatedEmployees = serverEmployees.map((employee) => {
        if (passwordClearedEmployeeIds.has(employee._id)) {
          return {
            ...employee,
            userId: {
              ...employee.userId,
              mustChangePassword: false,
            },
          };
        }

        return employee;
      });

      setFacultyList(updatedEmployees);
    } catch (error: any) {
      Alert.alert(
        'Could not load employees',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoadingEmployees(false);
    }
  }, [passwordClearedEmployeeIds]);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const response = await API.get('/departments', {
        params: { limit: 100 },
      });

      if (!Array.isArray(response.data?.data)) {
        throw new Error('The server returned an invalid department list.');
      }

      setDepartments(
        response.data.data.filter(
          (department: Department) => department.isActive !== false
        )
      );
    } catch (error: any) {
      Alert.alert(
        'Could not load departments',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  // ==========================================
  // SCHEDULES
  // ==========================================

  const fetchSchedules = useCallback(async () => {
    try {
      setLoadingSchedules(true);

      const response = await API.get('/admin/schedules');

      if (!Array.isArray(response.data?.data)) {
        throw new Error('The server returned an invalid schedule list.');
      }

      setSchedules(
        [...response.data.data].sort(
          (first: EmployeeSchedule, second: EmployeeSchedule) => {
            const dayDifference =
              WEEKDAYS.indexOf(first.dayOfWeek) -
              WEEKDAYS.indexOf(second.dayOfWeek);

            if (dayDifference !== 0) {
              return dayDifference;
            }

            return first.startTime.localeCompare(second.startTime);
          }
        )
      );
    } catch (error: any) {
      Alert.alert(
        'Could not load timetable',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  // ==========================================
  // TAB EFFECT
  // ==========================================

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchDashboard();

      const intervalId = setInterval(() => {
        fetchActiveUsers();
      }, 30000);

      return () => clearInterval(intervalId);
    }

    if (activeTab === 'faculty') {
      fetchEmployees();
    }

    if (activeTab === 'employee-schedules') {
      fetchSchedules();
      // Needed for the faculty quick-pick in the schedule form.
      fetchEmployees();
    }

    if (activeTab === 'active-users') {
      fetchActiveUsers();

      const intervalId = setInterval(() => {
        fetchActiveUsers();
      }, 30000);

      return () => clearInterval(intervalId);
    }
  }, [
    activeTab,
    fetchActiveUsers,
    fetchDashboard,
    fetchEmployees,
    fetchSchedules,
  ]);

  // ==========================================
  // FILTERED EMPLOYEES
  // ==========================================

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return facultyList;
    }

    return facultyList.filter((employee) => {
      const name = employee.userId?.name?.toLowerCase() || '';
      const email = employee.userId?.email?.toLowerCase() || '';
      const employeeId = employee.employeeId?.toLowerCase() || '';
      const designation = employee.designation?.toLowerCase() || '';
      const department =
        employee.departmentId?.name?.toLowerCase() || '';

      return (
        name.includes(query) ||
        email.includes(query) ||
        employeeId.includes(query) ||
        designation.includes(query) ||
        department.includes(query)
      );
    });
  }, [facultyList, searchQuery]);

  // ==========================================
  // TAB SELECT
  // ==========================================

  const handleTabSelect = (tabKey: string) => {
    setActiveTab(tabKey);
    setIsSidebarOpen(false);
    setSearchQuery('');
  };

  // ==========================================
  // OPEN ADD EMPLOYEE
  // ==========================================

  const openAddEmployeeModal = () => {
    setEditingEmployeeId(null);

    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewDesignation('');
    setNewPhone('');
    setNewQualification('');
    setNewSpecialization('');
    setNewJoiningDate('');
    setNewDepartmentId('');
    setShowDepartmentOptions(false);

    setModalVisible(true);
    fetchDepartments();
  };

  // ==========================================
  // OPEN EDIT EMPLOYEE
  // ==========================================

  const openEditEmployeeModal = (employee: Employee) => {
    setEditingEmployeeId(employee._id);

    setNewName(employee.userId?.name || '');
    setNewEmail(employee.userId?.email || '');
    setNewPassword('');
    setNewDesignation(employee.designation || '');
    setNewPhone(employee.phone || '');
    setNewQualification(employee.qualification || '');
    setNewSpecialization(employee.specialization || '');
    setNewJoiningDate(employee.joiningDate?.slice(0, 10) || '');
    setNewDepartmentId(
      typeof employee.departmentId === 'object' && employee.departmentId
        ? employee.departmentId._id || ''
        : ''
    );
    setShowDepartmentOptions(false);

    setModalVisible(true);
    fetchDepartments();
  };

  // ==========================================
  // CLOSE EMPLOYEE MODAL
  // ==========================================

  const closeEmployeeModal = () => {
    if (savingEmployee) {
      return;
    }

    setModalVisible(false);
    setEditingEmployeeId(null);

    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewDesignation('');
    setNewPhone('');
    setNewQualification('');
    setNewSpecialization('');
    setNewJoiningDate('');
    setNewDepartmentId('');
    setShowDepartmentOptions(false);
  };

  // ==========================================
  // PASSWORD VALIDATION
  // ==========================================

  const validatePassword = (password: string) => {
    if (password.length < 12) {
      return false;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return hasUppercase && hasLowercase && hasNumber && hasSpecial;
  };

  // ==========================================
  // ADD / UPDATE EMPLOYEE
  // ==========================================

  const handleSaveEmployee = async () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    const password = newPassword.trim();
    const designation = newDesignation.trim();
    const phone = newPhone.trim();
    const qualification = newQualification.trim();
    const specialization = newSpecialization.trim();
    const joiningDate = newJoiningDate.trim();

    if (!name || !email || !designation) {
      Alert.alert(
        'Missing fields',
        'Enter the employee name, email, and designation.'
      );
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      Alert.alert(
        'Invalid email',
        'Please enter a valid work email address.'
      );
      return;
    }

    if (!editingEmployeeId && !password) {
      Alert.alert(
        'Missing password',
        'Enter a temporary password for the new employee.'
      );
      return;
    }

    if (password && !validatePassword(password)) {
      Alert.alert(
        'Weak password',
        'Password must be at least 12 characters and contain uppercase, lowercase, a number, and a special character.'
      );
      return;
    }

    const currentEmployeeId = editingEmployeeId;

    try {
      setSavingEmployee(true);

      if (currentEmployeeId) {
        // ========================================
        // UPDATE EMPLOYEE
        // PATCH /admin/employees/:id
        // ========================================

        const payload: Record<string, string> = {
          name,
          email,
          designation,
          phone,
          qualification,
          specialization,
          joiningDate,
          departmentId: newDepartmentId,
        };

        if (password) {
          payload.password = password;
        }

        const response = await API.patch(
          `/admin/employees/${currentEmployeeId}`,
          payload
        );

        if (
          response.status < 200 ||
          response.status >= 300 ||
          response.data?.success === false
        ) {
          throw new Error(
            response.data?.message || 'Employee update failed.'
          );
        }

        /*
         * If a new password was supplied, mark the employee as having
         * completed password setup in the current UI.
         */
        if (password) {
          setPasswordClearedEmployeeIds((previous) => {
            const next = new Set(previous);
            next.add(currentEmployeeId);
            return next;
          });

          setFacultyList((previous) =>
            previous.map((employee) =>
              employee._id === currentEmployeeId
                ? {
                    ...employee,
                    userId: {
                      ...employee.userId,
                      mustChangePassword: false,
                    },
                  }
                : employee
            )
          );
        }

        Alert.alert(
          'Employee Updated',
          response.data?.message ||
            'Employee details have been updated successfully.'
        );
      } else {
        // ========================================
        // CREATE EMPLOYEE
        // POST /admin/employees
        // ========================================

        const response = await API.post('/admin/employees', {
          name,
          email,
          password,
          designation,
          phone,
          qualification,
          specialization,
          joiningDate,
          departmentId: newDepartmentId,
        });

        if (
          response.status < 200 ||
          response.status >= 300 ||
          response.data?.success === false
        ) {
          throw new Error(
            response.data?.message || 'Employee creation failed.'
          );
        }

        Alert.alert(
          'Employee Added',
          response.data?.message ||
            'Employee account has been created successfully.'
        );
      }

      setModalVisible(false);
      setEditingEmployeeId(null);

      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewDesignation('');
      setNewPhone('');

      /*
       * Refresh employees after the operation.
       *
       * The passwordClearedEmployeeIds state makes sure that a stale
       * mustChangePassword=true response does not immediately put the
       * pending message back on screen.
       */
      await fetchEmployees();
      await fetchDashboard();
    } catch (error: any) {
      Alert.alert(
        currentEmployeeId
          ? 'Could not update employee'
          : 'Could not add employee',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setSavingEmployee(false);
    }
  };

  // ==========================================
  // DELETE EMPLOYEE
  // ==========================================

//   const handleDeleteEmployee = (employee: Employee) => {
//   console.log('DELETE BUTTON CLICKED:', employee);
//   const employeeName = employee.userId?.name || 'this employee';
//   const employeeId = employee._id;

//   Alert.alert(
//     'Delete Employee',
//     `Are you sure you want to delete ${employeeName}? This will also delete the employee's schedules and cannot be undone.`,
//     [
//       {
//         text: 'Cancel',
//         style: 'cancel',
//       },
//       {
//         text: 'Delete',
//         style: 'destructive',
//         onPress: async () => {
//           try {
//             setLoadingEmployees(true);

//             console.log('DELETE EMPLOYEE:', {
//               employeeId,
//               employeeName,
//               userId: employee.userId?._id,
//             });

//             const response = await API.delete(
//               `/admin/employees/${employeeId}`
//             );

//             console.log('DELETE RESPONSE:', response.data);

//             if (
//               response.status < 200 ||
//               response.status >= 300 ||
//               response.data?.success === false
//             ) {
//               throw new Error(
//                 response.data?.message ||
//                   'Employee deletion failed.'
//               );
//             }

//             setFacultyList((previous) =>
//               previous.filter(
//                 (item) => item._id !== employeeId
//               )
//             );

//             setPasswordClearedEmployeeIds((previous) => {
//               const next = new Set(previous);
//               next.delete(employeeId);
//               return next;
//             });

//             Alert.alert(
//               'Employee Deleted',
//               response.data?.message ||
//                 `${employeeName} has been deleted successfully.`
//             );

//             await fetchEmployees();
//             await fetchDashboard();
//           } catch (error: any) {
//             console.log(
//               'DELETE EMPLOYEE ERROR:',
//               error?.response?.data || error
//             );

//             Alert.alert(
//               'Could not delete employee',
//               error?.response?.data?.message ||
//                 error?.message ||
//                 'Something went wrong.'
//             );
//           } finally {
//             setLoadingEmployees(false);
//           }
//         },
//       },
//     ]
//   );
// };


const handleDeleteEmployee = async (employee: Employee) => {
  const employeeName =
    employee.userId?.name || 'this employee';

  const employeeId = employee._id;

  console.log('DELETE BUTTON CLICKED:', employee);
  console.log('DELETE EMPLOYEE ID:', employeeId);

  try {
    setLoadingEmployees(true);

    console.log('CALLING DELETE API...');
    console.log(
      'URL:',
      `/admin/employees/${employeeId}`
    );

    const response = await API.delete(
      `/admin/employees/${employeeId}`
    );

    console.log('DELETE API RESPONSE:', response.status);
    console.log('DELETE API DATA:', response.data);

    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.data?.success === false
    ) {
      throw new Error(
        response.data?.message ||
          'Employee deletion failed.'
      );
    }

    setFacultyList((previous) =>
      previous.filter(
        (item) => item._id !== employeeId
      )
    );

    console.log('EMPLOYEE REMOVED FROM LOCAL STATE');

    await fetchEmployees();

    console.log('EMPLOYEES REFRESHED');

    await fetchDashboard();

    console.log('DASHBOARD REFRESHED');

    Alert.alert(
      'Employee Deleted',
      `${employeeName} has been deleted successfully.`
    );
  } catch (error: any) {
    console.log('DELETE API ERROR:', error);
    console.log(
      'DELETE ERROR RESPONSE:',
      error?.response?.data
    );
    console.log(
      'DELETE ERROR STATUS:',
      error?.response?.status
    );
    console.log(
      'DELETE ERROR URL:',
      error?.config?.url
    );

    Alert.alert(
      'Could not delete employee',
      error?.response?.data?.message ||
        error?.message ||
        'Something went wrong.'
    );
  } finally {
    setLoadingEmployees(false);
  }
};


  // ==========================================
  // CHANGE EMPLOYEE STATUS
  // ==========================================

//   const handleToggleEmployeeStatus = (employee: Employee) => {
//   const employeeName = employee.userId?.name || 'this employee';
//   const userId = employee.userId?._id;

//   console.log('====================================');
//   console.log('DEACTIVATE BUTTON CLICKED');
//   console.log('Employee:', employee);
//   console.log('Employee ID:', employee._id);
//   console.log('User ID:', userId);
//   console.log('Current status:', employee.userId?.isActive);
//   console.log('====================================');

//   if (!userId) {
//     Alert.alert(
//       'Unable to update status',
//       'This employee does not have a valid user account ID.'
//     );
//     return;
//   }

//   const currentStatus = Boolean(employee.userId?.isActive);
//   const nextStatus = !currentStatus;

//   Alert.alert(
//     nextStatus ? 'Activate Employee' : 'Deactivate Employee',
//     `Are you sure you want to ${
//       nextStatus ? 'activate' : 'deactivate'
//     } ${employeeName}?`,
//     [
//       {
//         text: 'Cancel',
//         style: 'cancel',
//       },
//       {
//         text: nextStatus ? 'Activate' : 'Deactivate',
//         style: nextStatus ? 'default' : 'destructive',

//         onPress: async () => {
//           console.log('====================================');
//           console.log('CONFIRM BUTTON PRESSED');
//           console.log('Sending status update...');
//           console.log('URL:', `/admin/users/${userId}/status`);
//           console.log('Payload:', {
//             isActive: nextStatus,
//           });
//           console.log('====================================');

//           try {
//             setLoadingEmployees(true);

//             const response = await API.patch(
//               `/admin/users/${userId}/status`,
//               {
//                 isActive: nextStatus,
//               }
//             );

//             console.log('====================================');
//             console.log('STATUS API SUCCESS');
//             console.log('Status:', response.status);
//             console.log('Response:', response.data);
//             console.log('====================================');

//             if (
//               response.status < 200 ||
//               response.status >= 300 ||
//               response.data?.success === false
//             ) {
//               throw new Error(
//                 response.data?.message ||
//                   'Status update failed.'
//               );
//             }

//             // Update UI immediately
//             setFacultyList((previous) =>
//               previous.map((item) =>
//                 item._id === employee._id
//                   ? {
//                       ...item,
//                       userId: {
//                         ...item.userId,
//                         isActive: nextStatus,
//                       },
//                     }
//                   : item
//               )
//             );

//             Alert.alert(
//               nextStatus
//                 ? 'Employee Activated'
//                 : 'Employee Deactivated',
//               response.data?.message ||
//                 `${employeeName} has been ${
//                   nextStatus ? 'activated' : 'deactivated'
//                 }.`
//             );

//             console.log('Refreshing employees...');

//             await fetchEmployees();

//             console.log('Refreshing dashboard...');

//             await fetchDashboard();

//             console.log('STATUS UPDATE COMPLETED');
//           } catch (error: any) {
//             console.log('====================================');
//             console.log('STATUS API ERROR');
//             console.log('Error:', error);
//             console.log(
//               'Response data:',
//               error?.response?.data
//             );
//             console.log(
//               'Response status:',
//               error?.response?.status
//             );
//             console.log(
//               'Request URL:',
//               error?.config?.url
//             );
//             console.log(
//               'Request method:',
//               error?.config?.method
//             );
//             console.log(
//               'Request data:',
//               error?.config?.data
//             );
//             console.log('====================================');

//             Alert.alert(
//               'Could not update status',
//               error?.response?.data?.message ||
//                 error?.message ||
//                 'Something went wrong.'
//             );
//           } finally {
//             setLoadingEmployees(false);
//           }
//         },
//       },
//     ]
//   );
// };


const handleToggleEmployeeStatus = async (employee: Employee) => {
  const employeeName = employee.userId?.name || 'this employee';
  const userId = employee.userId?._id;

  console.log('DEACTIVATE BUTTON CLICKED:', employee);

  if (!userId) {
    console.log('NO USER ID');
    Alert.alert(
      'Unable to update status',
      'This employee does not have a valid user account ID.'
    );
    return;
  }

  const currentStatus = Boolean(employee.userId?.isActive);
  const nextStatus = !currentStatus;

  console.log('USER ID:', userId);
  console.log('CURRENT STATUS:', currentStatus);
  console.log('NEXT STATUS:', nextStatus);

  // TEMPORARY DIRECT API TEST
  try {
    setLoadingEmployees(true);

    console.log('CALLING STATUS API...');
    console.log(
      'URL:',
      `/admin/users/${userId}/status`
    );

    const response = await API.patch(
      `/admin/users/${userId}/status`,
      {
        isActive: nextStatus,
      }
    );

    console.log('STATUS API RESPONSE:', response.status);
    console.log('STATUS API DATA:', response.data);

    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.data?.success === false
    ) {
      throw new Error(
        response.data?.message ||
          'Status update failed.'
      );
    }

    setFacultyList((previous) =>
      previous.map((item) =>
        item._id === employee._id
          ? {
              ...item,
              userId: {
                ...item.userId,
                isActive: nextStatus,
              },
            }
          : item
      )
    );

    console.log('LOCAL EMPLOYEE STATE UPDATED');

    await fetchEmployees();

    console.log('EMPLOYEES REFRESHED');

    await fetchDashboard();

    console.log('DASHBOARD REFRESHED');

    Alert.alert(
      nextStatus
        ? 'Employee Activated'
        : 'Employee Deactivated',
      `${employeeName} has been ${
        nextStatus ? 'activated' : 'deactivated'
      }.`
    );
  } catch (error: any) {
    console.log('STATUS API ERROR:', error);
    console.log(
      'STATUS ERROR RESPONSE:',
      error?.response?.data
    );
    console.log(
      'STATUS ERROR STATUS:',
      error?.response?.status
    );
    console.log(
      'STATUS ERROR URL:',
      error?.config?.url
    );

    Alert.alert(
      'Could not update status',
      error?.response?.data?.message ||
        error?.message ||
        'Something went wrong.'
    );
  } finally {
    setLoadingEmployees(false);
  }
};

  // ==========================================
  // OPEN ADD SCHEDULE
  // ==========================================

  const openAddScheduleModal = () => {
    setEditingScheduleId(null);

    setScheduleTitle('');
    setScheduleFacultyEmail('');
    setScheduleDay('Monday');
    setScheduleStart('');
    setScheduleEnd('');
    setScheduleLocation('');

    setScheduleModalVisible(true);
  };

  // ==========================================
  // OPEN EDIT SCHEDULE
  // ==========================================

  const openEditScheduleModal = (schedule: EmployeeSchedule) => {
    setEditingScheduleId(schedule._id);

    setScheduleTitle(schedule.title || '');
    setScheduleFacultyEmail(schedule.userId?.email || '');
    setScheduleDay(
      WEEKDAYS.includes(schedule.dayOfWeek)
        ? schedule.dayOfWeek
        : 'Monday'
    );
    setScheduleStart(schedule.startTime || '');
    setScheduleEnd(schedule.endTime || '');
    setScheduleLocation(schedule.location || '');

    setScheduleModalVisible(true);
  };

  // ==========================================
  // CLOSE SCHEDULE MODAL
  // ==========================================

  const closeScheduleModal = () => {
    if (savingSchedule) {
      return;
    }

    setScheduleModalVisible(false);
    setEditingScheduleId(null);

    setScheduleTitle('');
    setScheduleFacultyEmail('');
    setScheduleDay('Monday');
    setScheduleStart('');
    setScheduleEnd('');
    setScheduleLocation('');
  };

  // ==========================================
  // ADD / UPDATE SCHEDULE
  // ==========================================

  const handleSaveSchedule = async () => {
    const title = scheduleTitle.trim();
    const facultyEmail = scheduleFacultyEmail.trim().toLowerCase();
    const day = scheduleDay.trim();
    const start = scheduleStart.trim();
    const end = scheduleEnd.trim();
    const location = scheduleLocation.trim();

    if (!title || !facultyEmail || !day || !start || !end) {
      Alert.alert(
        'Missing fields',
        'Enter the activity, employee email, weekday, and start/end times.'
      );
      return;
    }

    if (!EMAIL_REGEX.test(facultyEmail)) {
      Alert.alert(
        'Invalid email',
        'Please enter a valid employee email address.'
      );
      return;
    }

    const normalizedDay =
      day.charAt(0).toUpperCase() +
      day.slice(1).toLowerCase();

    if (!WEEKDAYS.includes(normalizedDay)) {
      Alert.alert(
        'Invalid weekday',
        'Use a weekday such as Monday, Tuesday, or Wednesday.'
      );
      return;
    }

    if (!TIME_REGEX.test(start)) {
      Alert.alert(
        'Invalid start time',
        'Use 24-hour HH:MM format, for example 09:00.'
      );
      return;
    }

    if (!TIME_REGEX.test(end)) {
      Alert.alert(
        'Invalid end time',
        'Use 24-hour HH:MM format, for example 17:30.'
      );
      return;
    }

    if (start === end) {
      Alert.alert(
        'Invalid schedule',
        'Start time and end time cannot be the same.'
      );
      return;
    }

    try {
      setSavingSchedule(true);

      const payload = {
        title,
        facultyEmail,
        dayOfWeek: normalizedDay,
        startTime: start,
        endTime: end,
        location,
      };

      if (editingScheduleId) {
        const response = await API.patch(
          `/admin/schedules/${editingScheduleId}`,
          payload
        );

        if (
          response.status < 200 ||
          response.status >= 300 ||
          response.data?.success === false
        ) {
          throw new Error(
            response.data?.message || 'Schedule update failed.'
          );
        }

        Alert.alert(
          'Schedule Updated',
          response.data?.message ||
            'The employee schedule has been updated successfully.'
        );
      } else {
        const response = await API.post(
          '/admin/schedules',
          payload
        );

        if (
          response.status < 200 ||
          response.status >= 300 ||
          response.data?.success === false
        ) {
          throw new Error(
            response.data?.message || 'Schedule creation failed.'
          );
        }

        Alert.alert(
          'Schedule Added',
          response.data?.message ||
            'The employee schedule has been added successfully.'
        );
      }

      setScheduleModalVisible(false);
      setEditingScheduleId(null);

      setScheduleTitle('');
      setScheduleFacultyEmail('');
      setScheduleDay('Monday');
      setScheduleStart('');
      setScheduleEnd('');
      setScheduleLocation('');

      await fetchSchedules();
    } catch (error: any) {
      Alert.alert(
        editingScheduleId
          ? 'Could not update schedule'
          : 'Could not add schedule',
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  // ==========================================
  // DELETE SCHEDULE
  // ==========================================

  const handleDeleteSchedule = (schedule: EmployeeSchedule) => {
    Alert.alert(
      'Delete Schedule',
      `Are you sure you want to delete "${schedule.title}" from the timetable?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingSchedules(true);

              const response = await API.delete(
                `/admin/schedules/${schedule._id}`
              );

              if (
                response.status < 200 ||
                response.status >= 300 ||
                response.data?.success === false
              ) {
                throw new Error(
                  response.data?.message ||
                    'Schedule deletion failed.'
                );
              }

              /*
               * Remove immediately from local state.
               */
              setSchedules((previous) =>
                previous.filter(
                  (item) => item._id !== schedule._id
                )
              );

              Alert.alert(
                'Schedule Deleted',
                response.data?.message ||
                  'The employee schedule has been deleted successfully.'
              );

              await fetchSchedules();
            } catch (error: any) {
              Alert.alert(
                'Could not delete schedule',
                error?.response?.data?.message ||
                  error?.message ||
                  'Something went wrong.'
              );
            } finally {
              setLoadingSchedules(false);
            }
          },
        },
      ]
    );
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (error: any) {
      console.warn(
        'Server logout failed:',
        error?.response?.data?.message ||
          error?.message
      );
    }

    try {
      await AsyncStorage.multiRemove([
        'token',
        'userData',
      ]);

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
      }

      router.replace('/');
    } catch (error: any) {
      Alert.alert(
        'Logout failed',
        error?.message ||
          'Unable to clear the current session.'
      );
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <View style={styles.mainWrapper}>

      {/* =====================================
          TOP HEADER
      ===================================== */}

      <View style={styles.topHeader}>

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setIsSidebarOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuBtnText}>
            ☰ Menu
          </Text>
        </TouchableOpacity>

        <Text style={styles.topHeaderTitle}>
          Admin Portal
        </Text>

        <View style={styles.headerSpacer} />

      </View>

      {/* =====================================
          BODY
      ===================================== */}

      <View style={styles.contentBody}>

        {/* =====================================
            SIDEBAR
        ===================================== */}

        {isSidebarOpen && (
          <View style={styles.overlayContainer}>

            <TouchableOpacity
              style={styles.darkBackdrop}
              activeOpacity={1}
              onPress={() => setIsSidebarOpen(false)}
            />

            <View style={styles.drawerPanel}>

              <View>

                <View style={styles.brandHeaderRow}>

                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>
                      ADMIN PORTAL
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setIsSidebarOpen(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeIcon}>
                      ✕
                    </Text>
                  </TouchableOpacity>

                </View>

                <Text style={styles.brandTitle}>
                  Campus Master
                </Text>

                <Text style={styles.brandSub}>
                  System Control & Oversight
                </Text>

              </View>

              {/* NAVIGATION */}

              <View style={styles.navMenu}>

                {[
                  {
                    key: 'overview',
                    label: 'Overview & Stats',
                  },
                  {
                    key: 'faculty',
                    label: 'Employee Directory',
                  },
                  {
                    key: 'master-timetable',
                    label: 'Master Timetable',
                  },
                  {
                    key: 'employee-schedules',
                    label: 'Employee Schedules',
                  },
                  {
                    key: 'active-users',
                    label: 'Currently Logged In',
                  },
                ].map((item) => {

                  const isActive =
                    activeTab === item.key;

                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.navButton,
                        isActive &&
                          styles.activeNavButton,
                      ]}
                      onPress={() =>
                        handleTabSelect(item.key)
                      }
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.navButtonText,
                          isActive &&
                            styles.activeNavButtonText,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

              </View>

              {/* FOOTER */}

              <View style={styles.sidebarFooter}>

                <View style={styles.adminUserCard}>

                  <View style={styles.adminAvatar}>
                    <Text style={styles.adminAvatarText}>
                      A
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.adminName}>
                      Admin
                    </Text>

                    <Text style={styles.adminRole}>
                      Administrator
                    </Text>
                  </View>

                </View>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  activeOpacity={0.75}
                >
                  <Text style={styles.logoutButtonText}>
                    Logout
                  </Text>
                </TouchableOpacity>

              </View>

            </View>

          </View>
        )}

        {/* =====================================
            MAIN CONTENT
        ===================================== */}

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          <Text style={styles.mainHeading}>
            {activeTab === 'overview' &&
              'System Analytics & Overview'}

            {activeTab === 'faculty' &&
              'Employee Directory'}

            {activeTab === 'master-timetable' &&
              'Master Timetable'}

            {activeTab === 'employee-schedules' &&
              'Master Employee Timetable'}

            {activeTab === 'active-users' &&
              'Currently Logged In'}
          </Text>

          <Text style={styles.subHeading}>
            {activeTab === 'overview' &&
              'Real-time metrics across all departments and active portals.'}

            {activeTab === 'faculty' &&
              'Create, edit and manage employee directory details.'}

            {activeTab === 'master-timetable' &&
              'Manage the weekly class schedule for departments, courses, sections and faculty.'}

            {activeTab === 'employee-schedules' &&
              'Create, edit and manage weekly employee schedules.'}

            {activeTab === 'active-users' &&
              'Accounts with activity in the last five minutes; refreshes automatically.'}
          </Text>

          {/* =====================================
              OVERVIEW
          ===================================== */}

          {activeTab === 'overview' && (

            <View style={styles.sectionContainer}>

              {loadingOverview && !stats ? (
                <View style={styles.loaderContainer}>

                  <ActivityIndicator
                    size="large"
                    color="#2563EB"
                  />

                  <Text style={styles.loadingText}>
                    Loading dashboard...
                  </Text>

                </View>
              ) : (
                <>

                  {[
                    {
                      label: 'All Users',
                      value: stats?.users ?? 0,
                      color: '#3B82F6',
                    },
                    {
                      label: 'Enrolled Students',
                      value: stats?.students ?? 0,
                      color: '#8B5CF6',
                    },
                    {
                      label: 'Faculty Employees',
                      value: stats?.faculty ?? 0,
                      color: '#10B981',
                    },
                    {
                      label: 'Classes',
                      value: stats?.classes ?? 0,
                      color: '#F59E0B',
                    },
                    {
                      label: 'Open Doubts',
                      value: stats?.openDoubts ?? 0,
                      color: '#EF4444',
                    },
                    {
                      label: 'Currently Logged In',
                      value: activeUsers.length,
                      color: '#06B6D4',
                    },
                  ].map((stat) => (

                    <View
                      key={stat.label}
                      style={[
                        styles.statCard,
                        {
                          borderLeftColor:
                            stat.color,
                        },
                      ]}
                    >

                      <Text style={styles.statLabel}>
                        {stat.label}
                      </Text>

                      <Text style={styles.statNumber}>
                        {stat.value}
                      </Text>

                    </View>

                  ))}

                </>
              )}

            </View>
          )}

          {/* =====================================
              EMPLOYEE DIRECTORY
          ===================================== */}

          {activeTab === 'faculty' && (

            <View style={styles.sectionContainer}>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={openAddEmployeeModal}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>
                  + Add New Employee
                </Text>
              </TouchableOpacity>

              <TextInput
                style={styles.searchBar}
                placeholder="Search employee..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                returnKeyType="search"
              />

              {loadingEmployees ? (
                <View style={styles.loaderContainer}>

                  <ActivityIndicator
                    size="large"
                    color="#2563EB"
                  />

                  <Text style={styles.loadingText}>
                    Loading employees...
                  </Text>

                </View>
              ) : (
                <>

                  {filteredEmployees.map((emp) => (

                    <View
                      key={emp._id}
                      style={styles.empCard}
                    >

                      <View style={styles.empInfo}>

                        <Text style={styles.empName}>
                          {emp.userId?.name ||
                            'Faculty'}
                        </Text>

                        <Text style={styles.empDesignation}>
                          {emp.designation ||
                            'No designation'}
                          {' • '}
                          {emp.departmentId?.name ||
                            'No department'}
                        </Text>

                        <Text style={styles.empEmail}>
                          {emp.userId?.email ||
                            'No email'}
                        </Text>

                        <Text style={styles.empStatus}>
                          Employee ID:{' '}
                          {emp.employeeId ||
                            'N/A'}
                          {' • '}
                          {emp.userId?.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </Text>

                        {emp.userId
                          ?.mustChangePassword && (
                          <Text
                            style={
                              styles.passwordStatus
                            }
                          >
                            Temporary password pending
                          </Text>
                        )}

                      </View>

                      <View style={styles.actionRow}>

                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() =>
                            openEditEmployeeModal(emp)
                          }
                          activeOpacity={0.75}
                        >
                          <Text style={styles.editBtnText}>
                            Edit
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            emp.userId?.isActive
                              ? styles.statusBtn
                              : styles.activateBtn
                          }
                          onPress={() =>
                            handleToggleEmployeeStatus(
                              emp
                            )
                          }
                          activeOpacity={0.75}
                        >
                          <Text
                            style={
                              emp.userId?.isActive
                                ? styles.statusBtnText
                                : styles.activateBtnText
                            }
                          >
                            {emp.userId?.isActive
                              ? 'Deactivate'
                              : 'Activate'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() =>
                            handleDeleteEmployee(emp)
                          }
                          activeOpacity={0.75}
                        >
                          <Text style={styles.deleteBtnText}>
                            Delete
                          </Text>
                        </TouchableOpacity>

                      </View>

                    </View>

                  ))}

                  {filteredEmployees.length === 0 && (
                    <Text style={styles.emptyText}>
                      {facultyList.length === 0
                        ? 'No employees have been added yet.'
                        : 'No employees match your search.'}
                    </Text>
                  )}

                </>
              )}

            </View>
          )}

          {/* =====================================
              TIMETABLE
          ===================================== */}

          {activeTab === 'master-timetable' && (
            <View style={styles.sectionContainer}>
              <MasterTimetable />
            </View>
          )}

          {activeTab === 'employee-schedules' && (

            <View style={styles.sectionContainer}>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={openAddScheduleModal}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>
                  + Add Employee Schedule
                </Text>
              </TouchableOpacity>

              {loadingSchedules ? (
                <View style={styles.loaderContainer}>

                  <ActivityIndicator
                    size="large"
                    color="#2563EB"
                  />

                  <Text style={styles.loadingText}>
                    Loading timetable...
                  </Text>

                </View>
              ) : (
                <>

                  {schedules.map((schedule) => (

                    <View
                      key={schedule._id}
                      style={styles.empCard}
                    >

                      <View style={styles.empInfo}>

                        <Text style={styles.empName}>
                          {schedule.dayOfWeek}
                          {' · '}
                          {schedule.startTime}
                          {'–'}
                          {schedule.endTime}
                        </Text>

                        <Text style={styles.scheduleTitle}>
                          {schedule.title}
                        </Text>

                        <Text style={styles.empDesignation}>
                          {schedule.userId?.name ||
                            'Employee'}
                          {' · '}
                          {schedule.userId?.email ||
                            'No email'}
                        </Text>

                        {!!schedule.location && (
                          <Text style={styles.locationText}>
                            {schedule.location}
                          </Text>
                        )}

                      </View>

                      <View style={styles.actionRow}>

                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() =>
                            openEditScheduleModal(
                              schedule
                            )
                          }
                          activeOpacity={0.75}
                        >
                          <Text style={styles.editBtnText}>
                            Edit
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() =>
                            handleDeleteSchedule(
                              schedule
                            )
                          }
                          activeOpacity={0.75}
                        >
                          <Text style={styles.deleteBtnText}>
                            Delete
                          </Text>
                        </TouchableOpacity>

                      </View>

                    </View>

                  ))}

                  {schedules.length === 0 && (
                    <Text style={styles.emptyText}>
                      No employee schedules have
                      been added yet.
                    </Text>
                  )}

                </>
              )}

            </View>
          )}

          {/* =====================================
              ACTIVE USERS
          ===================================== */}

          {activeTab === 'active-users' && (

            <View style={styles.sectionContainer}>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={fetchActiveUsers}
                disabled={loadingActiveUsers}
                activeOpacity={0.8}
              >
                {loadingActiveUsers ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                    size="small"
                  />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Refresh
                  </Text>
                )}
              </TouchableOpacity>

              {loadingActiveUsers &&
              activeUsers.length === 0 ? (
                <View style={styles.loaderContainer}>

                  <ActivityIndicator
                    size="large"
                    color="#2563EB"
                  />

                  <Text style={styles.loadingText}>
                    Loading active users...
                  </Text>

                </View>
              ) : (
                <>

                  {activeUsers.map((user) => (

                    <View
                      key={user.id}
                      style={styles.empCard}
                    >

                      <Text style={styles.empName}>
                        {user.name ||
                          'Unknown User'}
                      </Text>

                      <Text style={styles.empDesignation}>
                        {user.email ||
                          'No email'}
                        {' · '}
                        {user.role ||
                          'User'}
                      </Text>

                      <Text style={styles.activeText}>
                        Active ·{' '}
                        {user.lastActivityAt
                          ? new Date(
                              user.lastActivityAt
                            ).toLocaleTimeString()
                          : 'Recently active'}
                      </Text>

                    </View>

                  ))}

                  {activeUsers.length === 0 && (
                    <Text style={styles.emptyText}>
                      No users have been active
                      in the last five minutes.
                    </Text>
                  )}

                </>
              )}

            </View>
          )}

        </ScrollView>
      </View>

      {/* ==========================================
          EMPLOYEE MODAL
      ========================================== */}

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeEmployeeModal}
      >

        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >

          <View style={styles.modalContent}>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.modalScrollContent
              }
            >

              <Text style={styles.modalTitle}>
                {editingEmployeeId
                  ? 'Edit Employee'
                  : 'Add Employee'}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
                editable={!savingEmployee}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Work email"
                placeholderTextColor="#94A3B8"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!savingEmployee}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Designation"
                placeholderTextColor="#94A3B8"
                value={newDesignation}
                onChangeText={setNewDesignation}
                editable={!savingEmployee}
              />

              <Text style={styles.chipLabel}>Department</Text>
              <TouchableOpacity
                style={styles.departmentSelector}
                onPress={() => setShowDepartmentOptions((visible) => !visible)}
                disabled={savingEmployee || loadingDepartments}
                activeOpacity={0.75}
              >
                <Text style={styles.departmentSelectorText}>
                  {loadingDepartments
                    ? 'Loading departments...'
                    : departments.find(
                        (department) => department._id === newDepartmentId
                      )?.name || 'Select department (optional)'}
                </Text>
                <Text style={styles.departmentSelectorChevron}>
                  {showDepartmentOptions ? '⌃' : '⌄'}
                </Text>
              </TouchableOpacity>

              {showDepartmentOptions ? (
                <ScrollView
                  style={styles.departmentOptions}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <TouchableOpacity
                    style={styles.departmentOption}
                    onPress={() => {
                      setNewDepartmentId('');
                      setShowDepartmentOptions(false);
                    }}
                  >
                    <Text style={styles.departmentOptionText}>
                      No department
                    </Text>
                  </TouchableOpacity>
                  {departments.map((department) => (
                    <TouchableOpacity
                      key={department._id}
                      style={styles.departmentOption}
                      onPress={() => {
                        setNewDepartmentId(department._id);
                        setShowDepartmentOptions(false);
                      }}
                    >
                      <Text style={styles.departmentOptionText}>
                        {department.name}
                        {department.code ? ` (${department.code})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {!loadingDepartments && departments.length === 0 ? (
                    <Text style={styles.departmentOptionText}>
                      No active departments available
                    </Text>
                  ) : null}
                </ScrollView>
              ) : null}

              <TextInput
                style={styles.modalInput}
                placeholder="Phone (optional)"
                placeholderTextColor="#94A3B8"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                editable={!savingEmployee}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Qualification (optional)"
                placeholderTextColor="#94A3B8"
                value={newQualification}
                onChangeText={setNewQualification}
                editable={!savingEmployee}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Specialization (optional)"
                placeholderTextColor="#94A3B8"
                value={newSpecialization}
                onChangeText={setNewSpecialization}
                editable={!savingEmployee}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Joining date (YYYY-MM-DD, optional)"
                placeholderTextColor="#94A3B8"
                value={newJoiningDate}
                onChangeText={setNewJoiningDate}
                keyboardType="numbers-and-punctuation"
                editable={!savingEmployee}
              />

              <TextInput
                style={styles.modalInput}
                placeholder={
                  editingEmployeeId
                    ? 'New password (optional)'
                    : 'Temporary password (12+ characters)'
                }
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!savingEmployee}
              />

              <Text style={styles.passwordHint}>
                {editingEmployeeId
                  ? 'Leave password empty if you do not want to change it.'
                  : 'Use at least 12 characters with uppercase, lowercase, a number, and a special character. The employee must change it at first sign-in.'}
              </Text>

              <View style={styles.modalActions}>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeEmployeeModal}
                  disabled={savingEmployee}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={savingEmployee}
                  style={[
                    styles.submitBtn,
                    savingEmployee &&
                      styles.disabledBtn,
                  ]}
                  onPress={handleSaveEmployee}
                  activeOpacity={0.8}
                >
                  {savingEmployee ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {editingEmployeeId
                        ? 'Update Employee'
                        : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>

              </View>

            </ScrollView>

          </View>

        </KeyboardAvoidingView>

      </Modal>

      {/* ==========================================
          SCHEDULE MODAL
      ========================================== */}

      <Modal
        visible={scheduleModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeScheduleModal}
      >

        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >

          <View style={styles.modalContent}>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.modalScrollContent
              }
            >

              <Text style={styles.modalTitle}>
                {editingScheduleId
                  ? 'Edit Employee Schedule'
                  : 'Add Employee Schedule'}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Activity or shift title"
                placeholderTextColor="#94A3B8"
                value={scheduleTitle}
                onChangeText={setScheduleTitle}
                editable={!savingSchedule}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Faculty email"
                placeholderTextColor="#94A3B8"
                value={scheduleFacultyEmail}
                onChangeText={setScheduleFacultyEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!savingSchedule}
              />

              {facultyList.length > 0 && (
                <>
                  <Text style={styles.chipLabel}>Tap to pick faculty</Text>
                  <View style={styles.chipRow}>
                    {facultyList
                      .filter((employee) => !!employee.userId?.email)
                      .map((employee) => {
                        const chipEmail = employee.userId?.email || '';
                        const selected =
                          scheduleFacultyEmail.trim().toLowerCase() ===
                          chipEmail.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={employee._id}
                            style={[styles.chip, selected && styles.chipActive]}
                            onPress={() => setScheduleFacultyEmail(chipEmail)}
                            disabled={savingSchedule}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                              {employee.userId?.name || chipEmail}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </>
              )}
              <TextInput
                style={styles.modalInput}
                placeholder="Weekday (e.g. Monday)"
                placeholderTextColor="#94A3B8"
                value={scheduleDay}
                onChangeText={setScheduleDay}
                autoCapitalize="words"
                editable={!savingSchedule}
              />

              <View style={styles.chipRow}>
                {WEEKDAYS.map((weekday) => (
                  <TouchableOpacity
                    key={weekday}
                    style={[styles.chip, scheduleDay === weekday && styles.chipActive]}
                    onPress={() => setScheduleDay(weekday)}
                    disabled={savingSchedule}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, scheduleDay === weekday && styles.chipTextActive]}>
                      {weekday.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Start time (24-hour HH:MM)"
                placeholderTextColor="#94A3B8"
                value={scheduleStart}
                onChangeText={setScheduleStart}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                editable={!savingSchedule}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="End time (24-hour HH:MM)"
                placeholderTextColor="#94A3B8"
                value={scheduleEnd}
                onChangeText={setScheduleEnd}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                editable={!savingSchedule}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Location (optional)"
                placeholderTextColor="#94A3B8"
                value={scheduleLocation}
                onChangeText={setScheduleLocation}
                editable={!savingSchedule}
              />

              <Text style={styles.passwordHint}>
                Use weekday names such as Monday and 24-hour time such as 09:00 or 14:30.
              </Text>

              <View style={styles.modalActions}>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeScheduleModal}
                  disabled={savingSchedule}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={savingSchedule}
                  style={[
                    styles.submitBtn,
                    savingSchedule &&
                      styles.disabledBtn,
                  ]}
                  onPress={handleSaveSchedule}
                  activeOpacity={0.8}
                >
                  {savingSchedule ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {editingScheduleId
                        ? 'Update Schedule'
                        : 'Save Schedule'}
                    </Text>
                  )}
                </TouchableOpacity>

              </View>

            </ScrollView>

          </View>

        </KeyboardAvoidingView>

      </Modal>

    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({

  mainWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F4F6F8',
  },

  topHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  menuBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  headerSpacer: {
    width: 70,
  },

  contentBody: {
    flex: 1,
    position: 'relative',
  },

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },

  mainHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },

  subHeading: {
    fontSize: 13,
    marginTop: 4,
    color: '#64748B',
    lineHeight: 19,
  },

  sectionContainer: {
    gap: 0,
    marginTop: 16,
  },

  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 12,
  },

  // ==========================================
  // SIDEBAR
  // ==========================================

  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 999,
    flexDirection: 'row',
  },

  darkBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },

  drawerPanel: {
    width: '80%',
    maxWidth: 300,
    height: '100%',
    padding: 20,
    justifyContent: 'space-between',
    zIndex: 100000,
    elevation: 25,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },

  brandHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },

  adminBadgeText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },

  brandSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 24,
  },

  closeButton: {
    padding: 6,
  },

  closeIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
  },

  navMenu: {
    gap: 10,
    flex: 1,
  },

  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  activeNavButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },

  navButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  activeNavButtonText: {
    color: '#2563EB',
    fontWeight: '700',
  },

  sidebarFooter: {
    gap: 12,
    marginTop: 'auto',
  },

  adminUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  adminAvatar: {
    width: 34,
    height: 34,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  adminAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  adminName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  adminRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  logoutButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  logoutButtonText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#0F172A',
  },

  // ==========================================
  // STAT CARDS
  // ==========================================

  statCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    marginBottom: 12,
  },

  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },

  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },

  // ==========================================
  // BUTTONS
  // ==========================================

  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    marginBottom: 14,
    minHeight: 40,
    justifyContent: 'center',
  },

  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // ==========================================
  // SEARCH
  // ==========================================

  searchBar: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    marginBottom: 12,
    color: '#0F172A',
  },

  // ==========================================
  // EMPLOYEE / SCHEDULE CARD
  // ==========================================

  empCard: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },

  empInfo: {
    flex: 1,
  },

  empName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  empDesignation: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },

  empEmail: {
    color: '#2563EB',
    fontSize: 11,
    marginTop: 4,
  },

  empStatus: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },

  passwordStatus: {
    color: '#D97706',
    fontSize: 11,
    marginTop: 5,
    fontWeight: '600',
  },

  scheduleTitle: {
    color: '#2563EB',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  locationText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },

  activeText: {
    color: '#10B981',
    fontSize: 11,
    marginTop: 4,
  },

  emptyText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 20,
  },

  // ==========================================
  // ACTIONS
  // ==========================================

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },

  editBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },

  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },

  statusBtnText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
  },

  activateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  activateBtnText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },

  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  deleteBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },

  // ==========================================
  // MODAL
  // ==========================================

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  modalContent: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  modalScrollContent: {
    paddingBottom: 2,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
    fontSize: 13,
    color: '#0F172A',
  },

  departmentSelector: {
    minHeight: 42,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  departmentSelectorText: {
    color: '#0F172A',
    fontSize: 13,
  },
  departmentSelectorChevron: {
    color: '#64748B',
    fontSize: 18,
  },
  departmentOptions: {
    maxHeight: 150,
    marginTop: -8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  departmentOption: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  departmentOptionText: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#334155',
    fontSize: 13,
  },

  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  passwordHint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 10,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },

  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minHeight: 36,
    justifyContent: 'center',
  },

  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },

  submitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563EB',
    minWidth: 110,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledBtn: {
    opacity: 0.7,
  },

  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

});
