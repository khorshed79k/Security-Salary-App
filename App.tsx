import React, { useState, useMemo, useEffect } from 'react';
import { Page, Employee, Payslip, OvertimeRecord, Settings, EmployeeCV, CVSection, CVField, CVListItem, Note } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EmployeeList from './components/EmployeeList';
import SalaryProcessing from './components/SalaryProcessing';
import Reports from './components/Reports';
import { DUMMY_EMPLOYEES, DUMMY_PAYSLIPS } from './constants';
import Overtime from './components/Overtime';
import OvertimeDetails from './components/OvertimeDetails';
import SettingsComponent from './components/Settings';
import EmployeeInformation from './components/EmployeeInformation';
import AbsentDeduction from './components/AbsentDeduction';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import { User } from './types';
import NoteTaking from './components/NoteTaking';
import FloatingNoteButton from './components/FloatingNoteButton';


const DEFAULT_SETTINGS: Settings = {
  overtimeMultiplier: 2,
  overtimeRate: 0,
  overtimeCalculationBasicSalary: 9500,
  workingDaysPerMonth: 30,
  workingHoursPerDay: 8,
  googleSheetsUrl: '',
};

const DUMMY_NOTES: Note[] = [
    {
        id: 'note-1',
        title: 'Meeting Agenda',
        content: '<ul><li>Discuss Q3 performance.</li><li>Plan for the upcoming production cycle.</li><li>Review safety protocols.</li></ul>',
        color: 'bg-blue-100',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'note-2',
        title: 'Urgent: Machine Maintenance',
        content: 'Conveyor belt C-4 is making a strange noise. Needs to be checked by the maintenance team ASAP.',
        color: 'bg-red-200',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
];

// This function creates a default CV structure based on the new template.
const createDefaultCV = (employeeId: string): EmployeeCV => ({
    employeeId,
    aboutMe: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pharetra in lorem at laoreet. Donec hendrerit libero eget est tempor, quis tempus arcu elementum. In elementum elit at dui tristique feugiat. Mauris convallis, mi at mattis malesuada, neque nulla volutpat dolor, hendrerit faucibus eros nibh ut nunc.',
    sections: [
        // RIGHT SIDE
        { id: 'work', title: 'WORK EXPERIENCE', layout: 'list', side: 'right', items: [] },
        { id: 'references', title: 'REFERENCES', layout: 'grid', side: 'right', items: [] },
        // LEFT SIDE
        { id: 'education', title: 'EDUCATION', layout: 'list', side: 'left', items: [] },
        { id: 'expertise', title: 'EXPERTISE', layout: 'tags', side: 'left', items: [] },
        { id: 'language', title: 'LANGUAGE', layout: 'tags', side: 'left', items: [
             { id: `lang-${Date.now()}-1`, label: 'English', value: '' },
             { id: `lang-${Date.now()}-2`, label: 'French', value: '' },
        ] },
    ]
});


// This function migrates old CV data to the new section-based format.
const migrateCVData = (oldCV: any): EmployeeCV => {
    // If it has 'sections', it's likely already in the new format or empty.
    if (!oldCV || Array.isArray(oldCV.sections)) {
        return oldCV;
    }

    const newCV: EmployeeCV = createDefaultCV(oldCV.employeeId);
    
    // Create a contact section from old fields
    const contactItems: CVField[] = [
        { id: 'phone', label: 'Phone', value: oldCV.contactNo || '' },
        { id: 'email', label: 'Email', value: oldCV.email || '' },
        { id: 'address', label: 'Address', value: oldCV.presentAddress || '' },
    ].filter(item => item.value);
    newCV.sections.unshift({ id: 'contact', title: 'CONTACT', layout: 'grid', side: 'left', items: contactItems });

    // Migrate education
    const educationSection = newCV.sections.find(s => s.id === 'education');
    if (educationSection && oldCV.educationalQualifications) {
        educationSection.items = oldCV.educationalQualifications.map((edu: any): CVListItem => ({
            id: edu.id || `edu-${Date.now()}`,
            title: edu.degree || '',
            subtitle: edu.institution || '',
            dateRange: edu.year || '',
            description: ''
        }));
    }

    // Migrate work experience
    const workSection = newCV.sections.find(s => s.id === 'work');
    if (workSection && oldCV.workExperience) {
        workSection.items = oldCV.workExperience.map((exp: any): CVListItem => ({
            id: exp.id || `work-${Date.now()}`,
            title: exp.position || '',
            subtitle: exp.company || '',
            dateRange: exp.duration || '',
            description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pharetra in lorem at laoreet.'
        }));
    }
    
    // Collect other personal details into a new section
    const personalDetailsItems: CVField[] = [
        { id: 'father', label: "Father's Name", value: oldCV.fatherName || '' },
        { id: 'mother', label: "Mother's Name", value: oldCV.motherName || '' },
        { id: 'dob', label: 'Date of Birth', value: oldCV.dateOfBirth || '' },
        { id: 'gender', label: 'Gender', value: oldCV.gender || '' },
        { id: 'marital', label: 'Marital Status', value: oldCV.maritalStatus || '' },
        { id: 'nationality', label: 'Nationality', value: oldCV.nationality || '' },
        { id: 'nid', label: 'NID', value: oldCV.nid || '' },
        { id: 'religion', label: 'Religion', value: oldCV.religion || '' },
        { id: 'perm-addr', label: 'Permanent Address', value: oldCV.permanentAddress || '' },
    ].filter(item => item.value);

    if (personalDetailsItems.length > 0) {
        const personalDetailsSection: CVSection = {
            id: 'personal',
            title: 'PERSONAL DETAILS',
            layout: 'grid',
            side: 'right',
            items: personalDetailsItems
        };
        newCV.sections.push(personalDetailsSection);
    }
    
    return newCV;
};


const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>(Page.Dashboard);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('factory_authenticated_user'));
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [loginError, setLoginError] = useState('');
  
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const savedUsers = localStorage.getItem('factory_users');
      return savedUsers ? JSON.parse(savedUsers) : [];
    } catch (error) {
      console.error("Failed to parse users from localStorage", error);
      return [];
    }
  });
  
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const savedEmployees = localStorage.getItem('factory_employees');
      return savedEmployees ? JSON.parse(savedEmployees) : DUMMY_EMPLOYEES;
    } catch (error) {
      console.error("Failed to parse employees from localStorage", error);
      return DUMMY_EMPLOYEES;
    }
  });

  const [payslips, setPayslips] = useState<Payslip[]>(() => {
    try {
      const savedPayslips = localStorage.getItem('factory_payslips');
      return savedPayslips ? JSON.parse(savedPayslips) : DUMMY_PAYSLIPS;
    } catch (error) {
      console.error("Failed to parse payslips from localStorage", error);
      return DUMMY_PAYSLIPS;
    }
  });

  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>(() => {
    try {
      const saved = localStorage.getItem('factory_overtime_records');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse overtime records from localStorage", error);
      return [];
    }
  });
  
  const [employeeCVs, setEmployeeCVs] = useState<EmployeeCV[]>(() => {
    try {
      const saved = localStorage.getItem('factory_employee_cvs');
      const parsed = saved ? JSON.parse(saved) : [];
      // Apply migration to each loaded CV
      return parsed.map(migrateCVData);
    } catch (error) {
      console.error("Failed to parse employee CVs from localStorage", error);
      return [];
    }
  });

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('factory_settings');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
      console.error("Failed to parse settings from localStorage", error);
      return DEFAULT_SETTINGS;
    }
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('factory_notes');
      return saved ? JSON.parse(saved) : DUMMY_NOTES;
    } catch (error) {
      console.error("Failed to parse notes from localStorage", error);
      return DUMMY_NOTES;
    }
  });
  
  useEffect(() => {
    localStorage.setItem('factory_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('factory_payslips', JSON.stringify(payslips));
  }, [payslips]);

  useEffect(() => {
    localStorage.setItem('factory_overtime_records', JSON.stringify(overtimeRecords));
  }, [overtimeRecords]);
  
  useEffect(() => {
    localStorage.setItem('factory_employee_cvs', JSON.stringify(employeeCVs));
  }, [employeeCVs]);

  useEffect(() => {
    localStorage.setItem('factory_settings', JSON.stringify(settings));
  }, [settings]);
  
  useEffect(() => {
    localStorage.setItem('factory_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('factory_notes', JSON.stringify(notes));
  }, [notes]);


  const handleLogin = (username: string, password: string): boolean => {
    // Check for demo user first
    if (username === 'admin' && password === 'password') {
      setIsAuthenticated(true);
      localStorage.setItem('factory_authenticated_user', username);
      setLoginError('');
      return true;
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setIsAuthenticated(true);
      localStorage.setItem('factory_authenticated_user', username);
      setLoginError('');
      return true;
    }

    setLoginError('Invalid username or password.');
    return false;
  };

  const handleSignUp = async (username: string, password: string): Promise<boolean> => {
    if (users.some(u => u.username === username)) {
      return false; // User already exists
    }

    setUsers(prev => [...prev, { username, password }]);

    // Log the signup to Google Sheets (without the password)
    if (settings.googleSheetsUrl) {
      try {
        const payload = { type: 'userSignUp', username };
        await fetch(settings.googleSheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.error('Failed to log signup to Google Sheets:', error);
        // We don't block the signup if this fails, just log the error.
      }
    }

    return true;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('factory_authenticated_user');
    setAuthView('login');
  };


  const handleAddEmployee = (employee: Employee) => {
    setEmployees([employee, ...employees]);
  };
  
  const handleBulkAddEmployees = (newEmployees: Employee[]) => {
    const existingIds = new Set(employees.map(e => e.employeeId));
    const uniqueNewEmployees = newEmployees.filter(ne => !existingIds.has(ne.employeeId));
    setEmployees(prev => [...uniqueNewEmployees, ...prev]);
    alert(`${uniqueNewEmployees.length} new employees imported successfully. ${newEmployees.length - uniqueNewEmployees.length} duplicates were ignored.`);
  };

  const handleUpdateEmployee = (updatedEmployee: Employee) => {
    setEmployees(
      employees.map((emp) =>
        emp.id === updatedEmployee.id ? updatedEmployee : emp
      )
    );
  };

  const handleDeleteEmployee = (employeeId: string) => {
    setEmployees(employees.filter((emp) => emp.id !== employeeId));
    setPayslips(payslips.filter((slip) => slip.employeeId !== employeeId));
    setOvertimeRecords(overtimeRecords.filter(rec => rec.employeeId !== employeeId));
    setEmployeeCVs(employeeCVs.filter(cv => cv.employeeId !== employeeId));
  };

  const handleProcessSalaries = (newPayslips: Payslip[]) => {
    const newPayslipIds = new Set(newPayslips.map(p => `${p.employeeId}-${p.month}-${p.year}`));
    const existingPayslips = payslips.filter(p => !newPayslipIds.has(`${p.employeeId}-${p.month}-${p.year}`));
    setPayslips([...existingPayslips, ...newPayslips]);
    setActivePage(Page.Reports);
  };
  
  const handleSaveOvertime = (newRecords: OvertimeRecord[]) => {
    setOvertimeRecords(prev => [...prev, ...newRecords]);
  };

  const handleDeleteOvertime = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this overtime record?')) {
        setOvertimeRecords(prev => prev.filter(r => r.id !== recordId));
    }
  };

  const handleDeleteBulkOvertime = (recordIds: string[]) => {
     setOvertimeRecords(prev => prev.filter(r => !recordIds.includes(r.id)));
  };
  
  const handleUpdateOvertime = (updatedRecord: OvertimeRecord) => {
    setOvertimeRecords(prev => 
        prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)
    );
  };

  const handleUpdateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    alert('Settings updated successfully!');
  };

  const handleSaveEmployeeCV = (cv: EmployeeCV) => {
    setEmployeeCVs(prev => {
        const existingIndex = prev.findIndex(c => c.employeeId === cv.employeeId);
        if (existingIndex > -1) {
            const updatedCVs = [...prev];
            updatedCVs[existingIndex] = cv;
            return updatedCVs;
        }
        return [...prev, cv];
    });
    alert('Employee information saved successfully!');
  };

  const handleImportAllData = (data: any) => {
      if (window.confirm('Are you sure you want to import this data? This will overwrite all existing data in the application.')) {
          try {
            if (!data.employees || !data.payslips || !data.overtimeRecords || !data.settings) {
                throw new Error("Invalid data file. Missing required data sections (employees, payslips, overtimeRecords, settings).");
            }
            setEmployees(data.employees);
            setPayslips(data.payslips);
            setOvertimeRecords(data.overtimeRecords);
            // Apply migration during import as well
            setEmployeeCVs((data.employeeCVs || []).map(migrateCVData));
            setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
            
            if (data.factory_categories) {
                localStorage.setItem('factory_categories', JSON.stringify(data.factory_categories));
            }
            if (data.factory_categorized_employees) {
                localStorage.setItem('factory_categorized_employees', JSON.stringify(data.factory_categorized_employees));
            }

            alert('Data imported successfully! The page will now reload to apply changes.');
            window.location.reload();
          } catch(error: any) {
            alert(`Error importing data: ${error.message}`);
          }
      }
  };

  const handleAddNote = (newNote: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const note: Note = {
        ...newNote,
        id: `note-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [note, ...prev]);
  };

  const handleUpdateNote = (updatedNote: Note) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? { ...updatedNote, updatedAt: new Date().toISOString() } : n));
  };
  
  const handleDeleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };


  const dashboardStats = useMemo(() => {
    const totalSalaryPaid = payslips.reduce((acc, slip) => acc + slip.netSalary, 0);
    const totalOvertime = overtimeRecords.reduce((acc, rec) => acc + rec.totalAmount, 0);
    const totalDeductions = payslips.reduce((acc, slip) => acc + slip.totalDeductions + slip.absentDeduction, 0);

    let topSalaryEarner = { name: 'N/A', amount: 0 };
    if (payslips.length > 0) {
        const salaryByEmployee = payslips.reduce((acc, slip) => {
            acc[slip.employeeId] = (acc[slip.employeeId] || 0) + slip.netSalary;
            return acc;
        }, {} as Record<string, number>);

        if (Object.keys(salaryByEmployee).length > 0) {
            const topEmployeeId = Object.keys(salaryByEmployee).reduce((a, b) => salaryByEmployee[a] > salaryByEmployee[b] ? a : b);
            const topEmployee = employees.find(e => e.id === topEmployeeId);
            if (topEmployee) {
                topSalaryEarner = { name: topEmployee.name, amount: salaryByEmployee[topEmployeeId] };
            }
        }
    }

    let topOvertimeEarner = { name: 'N/A', amount: 0 };
    if (overtimeRecords.length > 0) {
        const overtimeByEmployee = overtimeRecords.reduce((acc, rec) => {
            acc[rec.employeeId] = (acc[rec.employeeId] || 0) + rec.totalAmount;
            return acc;
        }, {} as Record<string, number>);
        
        if (Object.keys(overtimeByEmployee).length > 0) {
            const topEmployeeId = Object.keys(overtimeByEmployee).reduce((a, b) => overtimeByEmployee[a] > overtimeByEmployee[b] ? a : b);
            const topEmployee = employees.find(e => e.id === topEmployeeId);
            if (topEmployee) {
                topOvertimeEarner = { name: topEmployee.name, amount: overtimeByEmployee[topEmployeeId] };
            }
        }
    }

    let topDeductionPerson = { name: 'N/A', amount: 0 };
    if (payslips.length > 0) {
        const deductionsByEmployee = payslips.reduce((acc, slip) => {
            const total = slip.totalDeductions + slip.absentDeduction;
            acc[slip.employeeId] = (acc[slip.employeeId] || 0) + total;
            return acc;
        }, {} as Record<string, number>);

        if (Object.keys(deductionsByEmployee).length > 0) {
            const topEmployeeId = Object.keys(deductionsByEmployee).reduce((a, b) => deductionsByEmployee[a] > deductionsByEmployee[b] ? a : b);
            const topEmployee = employees.find(e => e.id === topEmployeeId);
            if (topEmployee) {
                topDeductionPerson = { name: topEmployee.name, amount: deductionsByEmployee[topEmployeeId] };
            }
        }
    }
    
    return {
      totalEmployees: employees.length,
      totalSalaryPaid: totalSalaryPaid,
      payslipsGenerated: payslips.length,
      totalOvertime,
      totalDeductions,
      topSalaryEarner,
      topOvertimeEarner,
      topDeductionPerson,
    };
  }, [employees, payslips, overtimeRecords]);

  const renderContent = () => {
    switch (activePage) {
      case Page.Dashboard:
        return <Dashboard stats={dashboardStats} setActivePage={setActivePage} employees={employees} payslips={payslips} />;
      case Page.EmployeeList:
        return (
          <EmployeeList
            employees={employees}
            onAdd={handleAddEmployee}
            onUpdate={handleUpdateEmployee}
            onDelete={handleDeleteEmployee}
            onBulkAdd={handleBulkAddEmployees}
          />
        );
      case Page.EmployeeInformation:
        return <EmployeeInformation employees={employees} employeeCVs={employeeCVs} onSave={handleSaveEmployeeCV} onUpdateEmployee={handleUpdateEmployee} />;
      case Page.AbsentDeduction:
        return <AbsentDeduction overtimeRecords={overtimeRecords} employees={employees} onDeleteBulk={handleDeleteBulkOvertime} onUpdateOvertime={handleUpdateOvertime} settings={settings} />;
      case Page.Overtime:
        return <Overtime employees={employees} onSave={handleSaveOvertime} settings={settings} />;
      case Page.OvertimeDetails:
        return <OvertimeDetails overtimeRecords={overtimeRecords} employees={employees} onDelete={handleDeleteOvertime} onUpdate={handleUpdateOvertime} settings={settings} />;
      case Page.SalaryProcessing:
        return <SalaryProcessing employees={employees} onProcess={handleProcessSalaries} overtimeRecords={overtimeRecords} settings={settings} />;
      case Page.Reports:
        return <Reports payslips={payslips} employees={employees} settings={settings} />;
       case Page.NoteTaking:
        return <NoteTaking notes={notes} onAdd={handleAddNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />;
       case Page.Settings:
        return <SettingsComponent 
            settings={settings} 
            onSave={handleUpdateSettings} 
            employees={employees}
            payslips={payslips}
            overtimeRecords={overtimeRecords}
            onAdd={handleAddEmployee}
            onUpdate={handleUpdateEmployee}
            onDelete={handleDeleteEmployee}
            onImportAllData={handleImportAllData}
            />;
      default:
        return <Dashboard stats={dashboardStats} setActivePage={setActivePage} employees={employees} payslips={payslips} />;
    }
  };
  
  if (!isAuthenticated) {
    if (authView === 'login') {
      return <LoginPage onLogin={handleLogin} onSwitchToSignUp={() => setAuthView('signup')} loginError={loginError} />;
    } else {
      return <SignUpPage onSignUp={handleSignUp} onSwitchToLogin={() => setAuthView('login')} settings={settings} />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-md p-4">
          <h1 className="text-2xl font-bold text-gray-800">{activePage}</h1>
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {renderContent()}
        </div>
      </main>
      <FloatingNoteButton onClick={() => setActivePage(Page.NoteTaking)} />
    </div>
  );
};

export default App;