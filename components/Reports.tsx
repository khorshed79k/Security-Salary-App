import React, { useState, useMemo } from 'react';
import { Payslip, Employee, Settings } from '../types';
import PayslipViewer from './PayslipViewer';

interface ReportsProps {
  payslips: Payslip[];
  employees: Employee[];
  settings: Settings;
}

const Reports: React.FC<ReportsProps> = ({ payslips, employees, settings }) => {
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  const handleViewPayslip = (payslip: Payslip) => {
    const employee = employees.find(emp => emp.id === payslip.employeeId);
    if (employee) {
        setSelectedPayslip(payslip);
        setSelectedEmployee(employee);
    }
  };

  const closeModal = () => {
    setSelectedPayslip(null);
    setSelectedEmployee(null);
  };
  
  const months = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);

  const availableYears = useMemo(() => {
      const years = new Set(payslips.map(p => p.year));
      // FIX: The `year` property from a payslip could be a string if loaded from localStorage.
      // Explicitly convert `a` and `b` to numbers before sorting to prevent type errors.
      return Array.from(years).sort((a,b) => Number(b) - Number(a));
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    return payslips
        .filter(p => {
            // FIX: Ensure comparison is between numbers, as `p.year` could be a string from localStorage.
            const yearMatch = selectedYear === 'all' || Number(p.year) === parseInt(selectedYear);
            // FIX: Ensure comparison is between numbers, as `p.month` could be a string from localStorage.
            const monthMatch = selectedMonth === 'all' || Number(p.month) === parseInt(selectedMonth);
            const searchMatch = searchTerm === '' || p.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
            return yearMatch && monthMatch && searchMatch;
        })
        // FIX: Ensure year and month are treated as numbers for correct sorting.
        .sort((a,b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month));
  }, [payslips, searchTerm, selectedYear, selectedMonth]);

  const handleSaveToSheets = async () => {
    if (!settings.googleSheetsUrl) {
        setSaveMessage('Google Sheets URL is not configured in Settings.');
        setTimeout(() => setSaveMessage(''), 5000);
        return;
    }
    if (filteredPayslips.length === 0) {
        setSaveMessage('There are no payslips in the current filter to save.');
         setTimeout(() => setSaveMessage(''), 5000);
        return;
    }

    const firstPayslip = filteredPayslips[0];
    // FIX: Ensure comparison is between numbers.
    const isSingleMonthYear = filteredPayslips.every(p => Number(p.month) === Number(firstPayslip.month) && Number(p.year) === Number(firstPayslip.year));

    if (!isSingleMonthYear) {
        setSaveMessage('Please filter by a single month and year to generate a report.');
         setTimeout(() => setSaveMessage(''), 5000);
        return;
    }
    
    setIsSaving(true);
    setSaveMessage('');
    try {
        const reportData = filteredPayslips.map(p => {
            const emp = employees.find(e => e.id === p.employeeId);
            return {
                ...p,
                allowances: emp?.allowances || [],
                deductions: emp?.deductions || [],
                employeeDisplayId: emp?.employeeId || '',
                department: emp?.department || '',
                designation: emp?.designation || '',
            };
        });

        const payload = {
            type: 'salaryReport',
            // FIX: Ensure month is a number for array indexing.
            month: months[Number(reportData[0].month)],
            year: reportData[0].year,
            data: reportData
        };

        // Note: 'no-cors' mode means we won't get a response back, but the request will be sent.
        // This is a common requirement for simple Google Apps Script web apps.
        await fetch(settings.googleSheetsUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        setSaveMessage(`Report for ${months[Number(firstPayslip.month)]} ${firstPayslip.year} sent to Google Sheets.`);

    } catch (error) {
        console.error('Error saving to Google Sheets:', error);
        setSaveMessage('Failed to save report. Check console for details.');
    } finally {
        setIsSaving(false);
        setTimeout(() => setSaveMessage(''), 5000);
    }
  };
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US').format(amount);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800 flex-shrink-0">Processed Payslip List</h2>
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto md:justify-end">
              <input 
                  type="text" 
                  placeholder="Search by name..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border rounded-md"
              />
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="px-3 py-2 border rounded-md">
                  <option value="all">All Months</option>
                  {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="px-3 py-2 border rounded-md">
                  <option value="all">All Years</option>
                  {availableYears.map(y => <option key={y as React.Key} value={y}>{y}</option>)}
              </select>
              <div className="flex items-center gap-2">
                {saveMessage && (
                    <span className={`text-sm font-medium transition-opacity duration-300 ${saveMessage.includes('Failed') || saveMessage.includes('not configured') || saveMessage.includes('Please filter') ? 'text-red-600' : 'text-green-600'}`}>
                        {saveMessage}
                    </span>
                )}
               <button 
                onClick={handleSaveToSheets} 
                disabled={isSaving || !settings.googleSheetsUrl}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                title={!settings.googleSheetsUrl ? "Configure Google Sheets URL in settings to enable this feature." : ""}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>
                  {isSaving ? 'Saving...' : 'Save to Sheets'}
              </button>
              </div>
          </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee Name</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Salary</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPayslips.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">No payslips found for the selected criteria.</td>
              </tr>
            ) : (
                filteredPayslips.map(p => (
                <tr key={p.id}>
                  {/* FIX: Ensure month is a number for array indexing. */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{months[Number(p.month)]} {p.year}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.employeeName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrency(p.netSalary)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        p.status === 'Processed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <button onClick={() => handleViewPayslip(p)} className="text-indigo-600 hover:text-indigo-900">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selectedPayslip && selectedEmployee && (
        <PayslipViewer 
          payslip={selectedPayslip} 
          employee={selectedEmployee} 
          onClose={closeModal} 
        />
      )}
    </div>
  );
};

export default Reports;