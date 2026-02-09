import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, LogOut, Settings, X, Check, AlertCircle, UserCheck, UserX, UserPlus, Trash2, Edit, DollarSign, FileWarning, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

// 輔助函式：取得今天的日期字串 (YYYY-MM-DD)
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function NMRBookingSystem() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [showHistoryNotice, setShowHistoryNotice] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showLabManagementPanel, setShowLabManagementPanel] = useState(false);
  const [showTimeSlotPanel, setShowTimeSlotPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [showEditLabModal, setShowEditLabModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingLab, setEditingLab] = useState(null);
  const [historyBookings, setHistoryBookings] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null);
  const [labs, setLabs] = useState([]);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [cleanupYear, setCleanupYear] = useState(new Date().getFullYear() - 1);
  const [timeSlotSettings, setTimeSlotSettings] = useState(null);
  const [newLabForm, setNewLabForm] = useState({ name: '', description: '' });
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    display_name: '',
    pi: '',
    instruments: [],
    is_admin: false
  });

  // === 新增功能的 State ===
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [currentViolationUser, setCurrentViolationUser] = useState(null);
  const [violationText, setViolationText] = useState('');
  const [hourlyRate, setHourlyRate] = useState(100);
  // ======================

  const INSTRUMENTS = ['60', '500'];

  // 生成時段
  const generateTimeSlots = useCallback(() => {
    if (!timeSlotSettings) return [];
    
    const slots = [];
    const { day_start, day_end, day_interval, night_start, night_end, night_interval } = timeSlotSettings;

    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const formatTime = (minutes) => {
      const h = Math.floor(minutes / 60) % 24;
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    let dayStartMin = parseTime(day_start);
    let dayEndMin = parseTime(day_end);

    for (let current = dayStartMin; current < dayEndMin; current += day_interval) {
      const end = current + day_interval;
      slots.push(`${formatTime(current)}-${formatTime(end)}`);
    }

    let nightStartMin = parseTime(night_start);
    let nightEndMin = parseTime(night_end) + (parseTime(night_end) < parseTime(night_start) ? 24 * 60 : 0);

    for (let current = nightStartMin; current < nightEndMin; current += night_interval) {
      const end = current + night_interval;
      slots.push(`${formatTime(current)}-${formatTime(end)}`);
    }

    const uniqueSlots = Array.from(new Set(slots));
    uniqueSlots.sort((a, b) => {
        const [aStart] = a.split('-');
        const [bStart] = b.split('-');
        return parseTime(aStart) - parseTime(bStart);
    });
    return uniqueSlots;

  }, [timeSlotSettings]);

  const timeSlots = useMemo(() => generateTimeSlots(), [generateTimeSlots]);

  // 資料載入函式
  const loadBookings = useCallback(async () => {
    if (!selectedInstrument || !selectedDate) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('instrument', selectedInstrument)
        .eq('date', selectedDate);
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('載入預約失敗:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedInstrument, selectedDate]);

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('載入用戶失敗:', error);
    }
  }, []);

  const loadHistoryBookings = useCallback(async (month) => {
    try {
      if (!month) {
        setHistoryBookings([]);
        return;
      }
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('booked_at', { ascending: false});
      
      if (error) throw error;
      setHistoryBookings(data || []);
    } catch (error) {
      console.error('載入歷史記錄失敗:', error);
      setHistoryBookings([]);
    }
  }, []);

  useEffect(() => {
    loadSystemSettings();
    loadLabs();
    loadTimeSlotSettings();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadBookings();
      if (currentUser?.is_admin) {
        loadUsers();
      }
    }
  }, [isLoggedIn, selectedInstrument, selectedDate, loadBookings, currentUser, loadUsers]);

  useEffect(() => {
    if (isLoggedIn && !selectedDate) {
      setSelectedDate(getTodayString());
    }
  }, [isLoggedIn, selectedDate]);

  useEffect(() => {
    if (showHistoryPanel) {
      if (!selectedMonth) {
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(currentMonth);
      } else {
         loadHistoryBookings(selectedMonth);
      }
    }
  }, [showHistoryPanel, selectedMonth, loadHistoryBookings]);

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data) {
        setSystemSettings(data);
        if (data.hourly_rate) setHourlyRate(data.hourly_rate);
      } else {
        const defaultSettings = {
          rule1: '請提前預約所需時段，系統開放預約未來時段',
          rule2: '不可預約或取消已過去的時間',
          rule3: '預約時間粒度為15分鐘（09:00-18:00）及30分鐘（18:00-09:00）',
          rule4: '請準時使用儀器，並保持儀器清潔',
          rule5: '使用前請確認已通過該儀器操作訓練',
          rule6: '如有問題請聯絡管理員',
          rule7: '',
          hourly_rate: 100
        };
        setSystemSettings(defaultSettings);
      }
    } catch (error) {
      console.error('載入系統設定失敗:', error);
    }
  };

  const loadTimeSlotSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('timeslot_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data) {
        setTimeSlotSettings(data);
      } else {
        const defaultTimeSlots = {
          day_start: '09:00',
          day_end: '18:00',
          day_interval: 15,
          night_start: '18:00',
          night_end: '09:00',
          night_interval: 30
        };
        setTimeSlotSettings(defaultTimeSlots);
      }
    } catch (error) {
      console.error('載入時段設定失敗:', error);
    }
  };

  const loadLabs = async () => {
    try {
      const { data, error } = await supabase.from('labs').select('*').order('name');
      if (error) throw error;
      setLabs(data || []);
    } catch (error) {
      console.error('載入 Lab 列表失敗:', error);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      alert('請輸入帳號和密碼\nPlease enter account and password');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', loginForm.username)
        .eq('password', loginForm.password)
        .single();
      if (error || !data) {
        alert('帳號或密碼錯誤\nIncorrect account or password');
        return;
      }

      if (data.active === false) {
        alert('此帳號已被停用，請聯絡管理員\nThis account has been disabled, please contact administrator');
        return;
      }

      setCurrentUser(data);
      setIsLoggedIn(true);
      setShowNotification(true);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      alert('登入失敗，請稍後再試\nLogin failed, please try again later');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedInstrument('');
    setSelectedDate('');
    setShowAdminPanel(false);
    setShowHistoryPanel(false);
    setShowSettingsPanel(false);
    setShowLabManagementPanel(false);
    setShowTimeSlotPanel(false);
    setBookings([]);
  };

  const isTimePassed = (date, timeSlot) => {
    const now = new Date();
    const selectedDateTime = new Date(date);
    const startTime = timeSlot.split('-')[0];
    const [hour, minute] = startTime.split(':').map(Number);
    selectedDateTime.setHours(hour, minute, 0, 0);
    return selectedDateTime < now;
  };

  const handleBooking = async (timeSlot) => {
    if (!selectedInstrument || !selectedDate) {
      alert('請選擇儀器和日期\nPlease select instrument and date');
      return;
    }

    if (isTimePassed(selectedDate, timeSlot)) {
      alert('不可預約已過去的時間\nCannot book past time slots');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          username: currentUser.username,
          display_name: currentUser.display_name,
          pi: currentUser.pi,
          instrument: selectedInstrument,
          date: selectedDate,
          time_slot: timeSlot
        }])
        .select();
      if (error) {
        if (error.code === '23505') {
          alert('此時段已被預約\nThis time slot is already booked');
        } else {
          throw error;
        }
        return;
      }
      alert('預約成功！\nBooking successful!');
      await loadBookings();
    } catch (error) {
      console.error('預約失敗:', error);
      alert('預約失敗，請稍後再試\nBooking failed, please try again later');
    }
  };

  const handleCancelBooking = async (bookingId, timeSlot) => {
    if (isTimePassed(selectedDate, timeSlot)) {
      alert('不可取消已過去的預約\nCannot cancel past bookings');
      return;
    }

    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      alert('已取消預約\nBooking cancelled');
      await loadBookings();
    } catch (error) {
      console.error('取消失敗:', error);
      alert('取消失敗，請稍後再試\nCancellation failed, please try again later');
    }
  };

  const toggleUserInstrument = async (userId, instrument) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    let newInstruments = [...(user.instruments || [])];
    if (newInstruments.includes(instrument)) {
      newInstruments = newInstruments.filter(i => i !== instrument);
    } else {
      newInstruments.push(instrument);
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ instruments: newInstruments })
        .eq('id', userId);
      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('更新權限失敗:', error);
      alert('更新失敗，請稍後再試');
    }
  };

  const toggleUserActive = async (userId, currentActive) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !currentActive })
        .eq('id', userId);
      if (error) throw error;
      await loadUsers();
      alert(currentActive ? '帳號已停用' : '帳號已啟用');
    } catch (error) {
      console.error('更新狀態失敗:', error);
      alert('更新失敗，請稍後再試');
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password || !newUserForm.display_name || !newUserForm.pi) {
      alert('請填寫所有必填欄位');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .insert([{
          username: newUserForm.username,
          password: newUserForm.password,
          display_name: newUserForm.display_name,
          pi: newUserForm.pi,
          instruments: newUserForm.instruments,
          is_admin: newUserForm.is_admin,
          active: true,
          violation_log: ''
        }]);
      if (error) {
        if (error.code === '23505') {
          alert('此帳號已存在');
        } else {
          throw error;
        }
        return;
      }
      alert('用戶新增成功！');
      setShowAddUserModal(false);
      setNewUserForm({
        username: '',
        password: '',
        display_name: '',
        pi: '',
        instruments: [],
        is_admin: false
      });
      await loadUsers();
    } catch (error) {
      console.error('新增用戶失敗:', error);
      alert('新增失敗，請稍後再試');
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      const updateData = {
        display_name: editingUser.display_name,
        pi: editingUser.pi,
        is_admin: editingUser.is_admin
      };
      if (editingUser.password) {
        updateData.password = editingUser.password;
      }
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', editingUser.id);
      if (error) throw error;
      alert('用戶資料已更新！');
      setShowEditUserModal(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      console.error('更新用戶失敗:', error);
      alert('更新失敗，請稍後再試');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`確定要刪除用戶 "${username}" 嗎？此操作無法復原！`)) {
      return;
    }
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      alert('用戶已刪除，但其歷史預約紀錄已保留。');
      await loadUsers();
    } catch (error) {
      console.error('刪除用戶失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  const handleClearHistory = async () => {
    if (!cleanupYear) {
      alert('請輸入年份');
      return;
    }
    const confirmMessage = `警告：您即將刪除 ${cleanupYear} 年 1 月 1 日之前的「所有」預約記錄。\n\n此操作僅會清除預約歷史，不會刪除任何用戶帳號。\n\n是否確定繼續？`;
    if (!window.confirm(confirmMessage)) return;
    if (!window.confirm('請再次確認：刪除後的資料無法復原。確定要執行嗎？')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete({ count: 'exact' })
        .lt('date', `${cleanupYear}-01-01`);
      if (error) throw error;

      alert(`清理完成！已刪除 ${cleanupYear} 年以前的舊記錄。`);
      setShowClearHistoryModal(false);
      if (selectedMonth) {
        await loadHistoryBookings(selectedMonth);
      }
    } catch (error) {
      console.error('清理歷史記錄失敗:', error);
      alert('清理失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!systemSettings) return;
    try {
      const { data: existing } = await supabase.from('system_settings').select('id').eq('id', 1).single();
      const updateData = {
        rule1: systemSettings.rule1,
        rule2: systemSettings.rule2,
        rule3: systemSettings.rule3,
        rule4: systemSettings.rule4,
        rule5: systemSettings.rule5,
        rule6: systemSettings.rule6,
        rule7: systemSettings.rule7,
        hourly_rate: hourlyRate
      };

      if (existing) {
        const { error } = await supabase.from('system_settings').update(updateData).eq('id', 1);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('system_settings').insert([{ id: 1, ...updateData }]);
        if (error) throw error;
      }
      alert('設定已儲存！');
    } catch (error) {
      console.error('儲存設定失敗:', error);
      alert('儲存失敗，請稍後再試');
    }
  };

  const handleSaveTimeSlotSettings = async () => {
    if (!timeSlotSettings) return;
    try {
      const { data: existing } = await supabase.from('timeslot_settings').select('id').eq('id', 1).single();
      if (existing) {
        const { error } = await supabase
          .from('timeslot_settings')
          .update({ ...timeSlotSettings })
          .eq('id', 1);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('timeslot_settings')
          .insert([{ id: 1, ...timeSlotSettings }]);
        if (error) throw error;
      }
      alert('時段設定已儲存！');
      await loadTimeSlotSettings();
    } catch (error) {
      console.error('儲存時段設定失敗:', error);
      alert('儲存失敗，請稍後再試');
    }
  };

  const exportToCSV = () => {
    if (historyBookings.length === 0) {
      alert('沒有資料可以匯出');
      return;
    }
    const headers = ['預約時間', '用戶名稱', 'Lab', '儀器 (MHz)', '預約日期', '時段'];
    const csvContent = [
      headers.join(','),
      ...historyBookings.map(booking => [
        `"${new Date(booking.booked_at).toLocaleString('zh-TW')}"`,
        `"${booking.display_name}"`,
        `"${booking.pi} Lab"`,
        booking.instrument,
        booking.date,
        `"${booking.time_slot}"`
      ].join(','))
    ].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `預約記錄_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddLab = async () => {
    if (!newLabForm.name || newLabForm.name.trim() === '') {
      alert('請輸入 Lab 名稱');
      return;
    }
    try {
      const { error } = await supabase
        .from('labs')
        .insert([{
          name: newLabForm.name.trim(),
          description: newLabForm.description
        }]);
      if (error) {
        if (error.code === '23505') alert('此 Lab 名稱已存在');
        else throw error;
        return;
      }
      alert('Lab 新增成功！');
      setShowAddLabModal(false);
      setNewLabForm({ name: '', description: '' });
      await loadLabs();
    } catch (error) {
      console.error('新增 Lab 失敗:', error);
      alert('新增失敗，請稍後再試');
    }
  };

  const handleEditLab = async () => {
    if (!editingLab || !editingLab.name || editingLab.name.trim() === '') {
      alert('請輸入 Lab 名稱');
      return;
    }
    try {
      const { error } = await supabase
        .from('labs')
        .update({
          name: editingLab.name.trim(),
          description: editingLab.description
        })
        .eq('id', editingLab.id);
      if (error) {
        if (error.code === '23505') alert('此 Lab 名稱已存在');
        else throw error;
        return;
      }
      alert('Lab 資料已更新！');
      setShowEditLabModal(false);
      setEditingLab(null);
      await loadLabs();
    } catch (error) {
      console.error('更新 Lab 失敗:', error);
      alert('更新失敗，請稍後再試');
    }
  };

  const handleDeleteLab = async (labId, labName) => {
    await loadUsers();
    const currentUsers = users.length > 0 ? users : (await supabase.from('users').select('*')).data || [];
    const usersWithLab = currentUsers.filter(u => u.pi === labName);
    if (usersWithLab.length > 0) {
      alert(`無法刪除：有 ${usersWithLab.length} 個用戶使用此 Lab`);
      return;
    }
    if (!window.confirm(`確定要刪除 Lab "${labName}" 嗎？`)) {
      return;
    }
    try {
      const { error } = await supabase.from('labs').delete().eq('id', labId);
      if (error) throw error;
      alert('Lab 已刪除');
      await loadLabs();
    } catch (error) {
      console.error('刪除 Lab 失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  const toggleNewUserInstrument = (instrument) => {
    const current = newUserForm.instruments;
    if (current.includes(instrument)) {
      setNewUserForm({ ...newUserForm, instruments: current.filter(i => i !== instrument) });
    } else {
      setNewUserForm({ ...newUserForm, instruments: [...current, instrument] });
    }
  };

  const getBookingForSlot = (timeSlot) => {
    return bookings.find(b => b.time_slot === timeSlot);
  };

  // === 違規事項相關函式 ===
  const openViolationModal = (user) => {
    setCurrentViolationUser(user);
    setViolationText(user.violation_log || '');
    setShowViolationModal(true);
  };

  const handleSaveViolation = async () => {
    if (!currentViolationUser) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ violation_log: violationText })
        .eq('id', currentViolationUser.id);
      
      if (error) throw error;
      
      alert('違規事項已儲存');
      setShowViolationModal(false);
      setCurrentViolationUser(null);
      await loadUsers();
    } catch (error) {
      console.error('儲存違規事項失敗:', error);
      alert('儲存失敗，請稍後再試');
    }
  };

  // === 計費相關輔助元件 ===
  const BillingModal = () => {
    // 1. 計算時數
    const calculateDurationInHours = (timeSlot) => {
      const [start, end] = timeSlot.split('-');
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      
      let startTotal = startH * 60 + startM;
      let endTotal = endH * 60 + endM;
      
      if (endTotal < startTotal) endTotal += 24 * 60;
      
      return (endTotal - startTotal) / 60;
    };

    // 2. 整理每個 Lab 和用戶的數據
    const billingData = useMemo(() => {
      const data = {};
      labs.forEach(lab => {
        data[lab.name] = { totalHours: 0, users: {} };
      });

      historyBookings.forEach(booking => {
        const duration = calculateDurationInHours(booking.time_slot);
        const labName = booking.pi;
        const userName = booking.display_name;

        if (!data[labName]) {
            data[labName] = { totalHours: 0, users: {} };
        }
        data[labName].totalHours += duration;
        if (!data[labName].users[userName]) {
          data[labName].users[userName] = 0;
        }
        data[labName].users[userName] += duration;
      });

      return data;
    }, [historyBookings, labs]);

    // 3. 儲存費率
    const saveHourlyRate = async () => {
      try {
        const { error } = await supabase
          .from('system_settings')
          .update({ hourly_rate: hourlyRate })
          .eq('id', 1);
        if (error) throw error;
      } catch (e) {
        console.error("費率儲存失敗", e);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[80vh] flex overflow-hidden">
          {/* 左側控制區 */}
          <div className="w-1/3 bg-gray-50 p-6 border-r flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
              <DollarSign className="w-6 h-6 text-green-600" />
              計費設定
            </h2>

            {/* === 新增：月份選擇器 === */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-2">選擇計費月份</label>
               <input
                 type="month"
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(e.target.value)}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
               />
            </div>
            {/* ======================= */}
            
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">每小時費率 (NTD)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  onBlur={saveHourlyRate}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">輸入後自動儲存</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
               <h3 className="font-semibold text-blue-800 mb-2">統計資訊</h3>
               <p className="text-sm text-blue-700">統計月份: <span className="font-bold">{selectedMonth}</span></p>
               <p className="text-sm text-blue-700">總預約數: {historyBookings.length} 筆</p>
            </div>

            <div className="mt-auto">
              <button 
                onClick={() => setShowBillingModal(false)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                關閉視窗
              </button>
            </div>
          </div>

          {/* 右側列表區 */}
          <div className="w-2/3 p-6 overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">費用報表</h3>
            <div className="space-y-4">
              {Object.entries(billingData).map(([labName, data]) => (
                <LabBillingRow 
                  key={labName} 
                  labName={labName} 
                  data={data} 
                  rate={hourlyRate} 
                />
              ))}
              {Object.keys(billingData).length === 0 && (
                 <div className="text-center text-gray-400 py-10">
                   {selectedMonth ? '本月份尚無預約資料' : '請選擇月份以查看報表'}
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LabBillingRow = ({ labName, data, rate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const totalCost = data.totalHours * rate;

    return (
      <div className="border rounded-lg overflow-hidden">
        <div 
          className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            <span className="font-bold text-lg">{labName} Lab</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-sm text-gray-500">{data.totalHours.toFixed(1)} 小時</p>
                <p className="font-bold text-green-700 text-lg">${Math.round(totalCost).toLocaleString()}</p>
             </div>
          </div>
        </div>
        
        {isOpen && (
          <div className="bg-white p-4 border-t">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">用戶</th>
                  <th className="px-4 py-2 text-right">時數</th>
                  <th className="px-4 py-2 text-right">費用</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(data.users).map(([user, hours]) => (
                  <tr key={user}>
                    <td className="px-4 py-2">{user}</td>
                    <td className="px-4 py-2 text-right">{hours.toFixed(1)} hr</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">
                      ${Math.round(hours * rate).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {Object.keys(data.users).length === 0 && (
                  <tr><td colSpan="3" className="px-4 py-2 text-center text-gray-400">本月無使用紀錄</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-1/2 p-8">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-8 h-8 text-indigo-600" />
                <h1 className="text-3xl font-bold text-gray-800">NMR預約系統</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">帳號 Account</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密碼 Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleLogin}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  登入 Login
                </button>
              </div>
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="mb-1">請使用您的帳號密碼登入系統</p>
                    <p>Please login with your account and password</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 bg-indigo-600 text-white p-8 flex flex-col max-h-screen">
              <h2 className="text-2xl font-bold mb-6 flex-shrink-0">使用規則 Rules</h2>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                {systemSettings ? (
                  [1, 2, 3, 4, 5, 6, 7].map(num => {
                    const ruleText = systemSettings[`rule${num}`];
                    if (!ruleText || ruleText.trim() === '') return null;
                    return (
                      <div key={num} className="flex items-start gap-3">
                        <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                        <p className="whitespace-pre-wrap">{ruleText}</p>
                      </div>
                    );
                  })
                ) : (
                  <p>載入中...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showNotification) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">登入成功！</h2>
            <p className="text-gray-600 mb-6">歡迎使用NMR預約系統<br/>Welcome to NMR Booking System</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-700 mb-3"><strong>注意事項 Notes:</strong></p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="list-none">• 請勿預約已過去的時段<span className="ml-3 block text-xs text-gray-500">Do not book past time slots</span></li>
                <li className="list-none">• 預約後請準時使用<span className="ml-3 block text-xs text-gray-500">Please use the equipment on time</span></li>
                <li className="list-none">• 使用完畢請保持儀器清潔<span className="ml-3 block text-xs text-gray-500">Keep the equipment clean after use</span></li>
              </ul>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showHistoryNotice && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">歷史記錄管理提醒</h2>
            <p className="text-gray-600 mb-6">數據維護是管理員的重要職責。</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-700 mb-3"><strong>數據維護注意事項 Notes:</strong></p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="list-none text-red-700 font-semibold">• 因後臺容量有限，記得每年一月執行一次數據清理！</li>
                <li className="list-none">• 手動刪除帳號會保留其歷史預約記錄。</li>
                <li className="list-none">• 選擇月份，下載歷史記錄即可得到選擇月份的預約紀錄。</li>
              </ul>
            </div>
            <button
              onClick={() => {
                setShowHistoryNotice(false);
                setShowHistoryPanel(true);
              }}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              我知道了，查看歷史記錄
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showClearHistoryModal && currentUser?.is_admin) {
    const currentYear = new Date().getFullYear();
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-t-4 border-red-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-600" />
              清除舊資料
            </h2>
            <button onClick={() => setShowClearHistoryModal(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 text-sm font-bold mb-1">警告 Warning</p>
                <p className="text-red-700 text-sm leading-relaxed">
                  此操作將永久刪除指定年份之前的預約記錄。<br/>
                  <span className="font-semibold">注意：</span>此操作無法復原，但<span className="underline">不會刪除</span>任何用戶帳號。
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">清除截止年份 (Cutoff Year)</label>
              <div className="relative">
                <input
                  type="number"
                  value={cleanupYear}
                  onChange={(e) => setCleanupYear(e.target.value)}
                  min="2000"
                  max={currentYear}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-lg font-medium"
                />
                <span className="absolute right-4 top-3.5 text-gray-400 text-sm">年</span>
              </div>
              <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                範例：若輸入 <strong>{currentYear}</strong>，則 <strong>{currentYear - 1}年12月31日</strong> (含)以前的所有舊記錄都會被刪除。
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setShowClearHistoryModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">取消</button>
            <button onClick={handleClearHistory} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2 shadow-lg shadow-red-200">
              <Trash2 className="w-4 h-4" />
              確認清除
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showViolationModal && currentViolationUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border-t-4 border-yellow-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileWarning className="w-6 h-6 text-yellow-600" />
              違規紀錄筆記本
            </h2>
            <button onClick={() => setShowViolationModal(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="mb-4">
            <p className="text-gray-700 font-medium">用戶: {currentViolationUser.display_name} ({currentViolationUser.username})</p>
            <p className="text-sm text-gray-500">Lab: {currentViolationUser.pi}</p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">違規事項紀錄</label>
            <textarea
              value={violationText}
              onChange={(e) => setViolationText(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="在此輸入違規事項、日期與原因..."
            />
            <p className="text-xs text-gray-500">此紀錄僅供管理員查看，不會顯示給用戶。</p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowViolationModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">取消</button>
            <button onClick={handleSaveViolation} className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium flex items-center justify-center gap-2 shadow-lg shadow-yellow-200">
              <Save className="w-4 h-4" />
              儲存紀錄
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showBillingModal) {
    return <BillingModal />;
  }

  if (showAddLabModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">新增 Lab</h2>
            <button onClick={() => setShowAddLabModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label><input type="text" value={newLabForm.name} onChange={(e) => setNewLabForm({...newLabForm, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="例如：003"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">描述（選填）</label><input type="text" value={newLabForm.description} onChange={(e) => setNewLabForm({...newLabForm, description: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="例如：有機化學實驗室"/></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowAddLabModal(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">取消</button>
            <button onClick={handleAddLab} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">新增</button>
          </div>
        </div>
      </div>
    );
  }

  if (showEditLabModal && editingLab) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">編輯 Lab</h2>
            <button onClick={() => { setShowEditLabModal(false); setEditingLab(null); }} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label><input type="text" value={editingLab.name} onChange={(e) => setEditingLab({...editingLab, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">描述（選填）</label><input type="text" value={editingLab.description || ''} onChange={(e) => setEditingLab({...editingLab, description: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => { setShowEditLabModal(false); setEditingLab(null); }} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">取消</button>
            <button onClick={handleEditLab} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">儲存</button>
          </div>
        </div>
      </div>
    );
  }

  if (showAddUserModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">新增用戶</h2>
            <button onClick={() => setShowAddUserModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">帳號 *</label><input type="text" value={newUserForm.username} onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="例如：chen123"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">密碼 *</label><input type="text" value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="設定密碼"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">顯示名稱 *</label><input type="text" value={newUserForm.display_name} onChange={(e) => setNewUserForm({...newUserForm, display_name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="例如：陳小明"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label><select value={newUserForm.pi} onChange={(e) => setNewUserForm({...newUserForm, pi: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"><option value="">請選擇 Lab</option>{labs.map(lab => (<option key={lab.id} value={lab.name}>{lab.name} {lab.description && `(${lab.description})`}</option>))}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">儀器權限</label><div className="flex gap-3">{INSTRUMENTS.map(instrument => (<button key={instrument} onClick={() => toggleNewUserInstrument(instrument)} className={`px-4 py-2 rounded-lg font-medium transition ${newUserForm.instruments.includes(instrument) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{instrument} MHz {newUserForm.instruments.includes(instrument) ? '✓' : ''}</button>))}</div></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="is_admin" checked={newUserForm.is_admin} onChange={(e) => setNewUserForm({...newUserForm, is_admin: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded"/><label htmlFor="is_admin" className="text-sm text-gray-700">設為管理員</label></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowAddUserModal(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">取消</button>
            <button onClick={handleAddUser} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">新增</button>
          </div>
        </div>
      </div>
    );
  }

  if (showEditUserModal && editingUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">編輯用戶</h2>
            <button onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">帳號</label><input type="text" value={editingUser.username} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"/><p className="text-xs text-gray-500 mt-1">帳號無法修改</p></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">新密碼（留空表示不修改）</label><input type="text" value={editingUser.password || ''} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="輸入新密碼或留空"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">顯示名稱 *</label><input type="text" value={editingUser.display_name} onChange={(e) => setEditingUser({...editingUser, display_name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label><select value={editingUser.pi} onChange={(e) => setEditingUser({...editingUser, pi: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"><option value="">請選擇 Lab</option>{labs.map(lab => (<option key={lab.id} value={lab.name}>{lab.name} {lab.description && `(${lab.description})`}</option>))}</select></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="edit_is_admin" checked={editingUser.is_admin} onChange={(e) => setEditingUser({...editingUser, is_admin: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded"/><label htmlFor="edit_is_admin" className="text-sm text-gray-700">設為管理員</label></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">取消</button>
            <button onClick={handleEditUser} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">儲存</button>
          </div>
        </div>
      </div>
    );
  }

  if (showTimeSlotPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">時段設定</h1>
            <button onClick={() => setShowTimeSlotPanel(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"><X className="w-4 h-4" />返回</button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">預約時段設定</h2>
            <p className="text-sm text-gray-600 mb-6">設定日間和夜間的時段區間和間隔時間</p>
            {timeSlotSettings && (
              <div className="space-y-6">
                <div className="border-b pb-6">
                  <h3 className="font-semibold text-lg mb-4">日間時段</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label><input type="time" value={timeSlotSettings.day_start} onChange={(e) => setTimeSlotSettings({...timeSlotSettings, day_start: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">結束時間</label><input type="time" value={timeSlotSettings.day_end} onChange={(e) => setTimeSlotSettings({...timeSlotSettings, day_end: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">時段間隔（分鐘）</label><select value={timeSlotSettings.day_interval} onChange={(e) => setTimeSlotSettings({...timeSlotSettings, day_interval: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="15">15 分鐘</option><option value="30">30 分鐘</option><option value="60">60 分鐘</option></select></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">例如：09:00-18:00，每 15 分鐘一個時段</p>
                </div>
                <div className="border-b pb-6">
                  <h3 className="font-semibold text-lg mb-4">夜間時段</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label><input type="time" value={timeSlotSettings.night_start} onChange={(e) => setTimeSlotSettings({...timeSlotSettings, night_start: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">結束時間（隔天）</label><input type="time" value={timeSlotSettings.night_end} onChange={(e) => setTimeSlotSettings({...timeSlotSettings, night_end: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">時段間隔（分鐘）</label><select value={timeSlotSettings.night_interval} onChange={(e) => setTimeSlotSettings({...timeSlotSettings, night_interval: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="15">15 分鐘</option><option value="30">30 分鐘</option><option value="60">60 分鐘</option></select></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">例如：18:00-隔天09:00，每 30 分鐘一個時段</p>
                </div>
                <button onClick={handleSaveTimeSlotSettings} className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">儲存時段設定</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showSettingsPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">系統設定</h1>
            <button onClick={() => setShowSettingsPanel(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"><X className="w-4 h-4" />返回</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-2">編輯使用規則</h2>
              <p className="text-sm text-gray-600 mb-6">修改登入頁面右側顯示的使用規則文字</p>
              {systemSettings && (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <div key={num}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">規則 {num}</label>
                      <textarea value={systemSettings[`rule${num}`]} onChange={(e) => setSystemSettings({ ...systemSettings, [`rule${num}`]: e.target.value })} rows={3} className="w-full px