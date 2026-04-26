import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, LogOut, Settings, X, Check, AlertCircle, UserCheck, UserX, UserPlus, Trash2, Edit, DollarSign, FileWarning, Save, ChevronDown, ChevronRight, Zap, Eye, EyeOff } from 'lucide-react';
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
  // === 新增的控制狀態 ===
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLabFilter, setSelectedLabFilter] = useState('');
  // ======================

// --- 新增以下三個狀態 ---
  const [violationReason, setViolationReason] = useState(''); 
  const [penaltyStart, setPenaltyStart] = useState('');
  const [penaltyEnd, setPenaltyEnd] = useState('');
  const [violationHistory, setViolationHistory] = useState([]);

// --- 新增自訂模板的 State ---
  const [violationPresets, setViolationPresets] = useState([]);
  const [newPresetReason, setNewPresetReason] = useState('');
  const [newPresetDays, setNewPresetDays] = useState('');

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

// 載入系統設定時，一併載入處罰清單
  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (data) {
        setSystemSettings(data);
        if (data.hourly_rate) setHourlyRate(data.hourly_rate);
        // [關鍵] 載入您設定的處罰事項
        if (data.violation_presets) setViolationPresets(data.violation_presets);
      }
    } catch (error) { console.error('載入設定失敗:', error); }
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

      // --- [新增] 自動處罰判定邏輯 ---
      if (data.penalty_start && data.penalty_end) {
        const now = new Date();
        const start = new Date(data.penalty_start);
        const end = new Date(data.penalty_end);
        
        // 如果現在時間介於處罰開始與結束之間，則拒絕登入
        if (now >= start && now <= end) {
          const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
          alert(`⛔ 此帳號因「${data.violation_reason || '違規事項'}」暫停使用。\n\n處罰期間：\n${start.toLocaleString('zh-TW', options)} 至 ${end.toLocaleString('zh-TW', options)}`);
          return;
        }
      }
      // -----------------------------

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
        hourly_rate: hourlyRate,
        // --- 新增這行：儲存自訂模板 ---
        violation_presets: violationPresets 
      };
      // ... (保持原本的 if/else 儲存邏輯)

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
    setViolationReason(user.violation_reason || '');
    
    // 修正1：將資料庫的 UTC 時間轉為台灣本地時間給介面顯示
    const formatLocal = (dbDateStr) => {
      if (!dbDateStr) return '';
      const d = new Date(dbDateStr);
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d - offset).toISOString().slice(0, 16);
    };

    setPenaltyStart(formatLocal(user.penalty_start));
    setPenaltyEnd(formatLocal(user.penalty_end));
    setViolationHistory(user.violation_history || []);
    setShowViolationModal(true);
  };

  const handleSelectPreset = (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex === "manual") return;
    
    const preset = violationPresets[selectedIndex];
    if (!preset) return;

    setViolationReason(preset.reason);
    
    const now = new Date();
    const end = new Date(now.getTime() + preset.days * 24 * 60 * 60 * 1000);
    
    const toLocalISO = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date - offset).toISOString().slice(0, 16);
    };
    
    setPenaltyStart(toLocalISO(now));
    setPenaltyEnd(toLocalISO(end));
  };

  const handleClearPenalty = () => {
    setViolationReason('');
    setPenaltyStart('');
    setPenaltyEnd('');
    setViolationText('');
  };

  const handleSaveViolation = async () => {
    if (!currentViolationUser) return;
    try {
      let updatedHistory = [...(violationHistory || [])];
      
      // 修正2：將介面上的本地時間轉回標準時間存入資料庫，解決 8 小時時差
      const saveStart = penaltyStart ? new Date(penaltyStart).toISOString() : null;
      const saveEnd = penaltyEnd ? new Date(penaltyEnd).toISOString() : null;
      
      if (violationReason && penaltyStart && penaltyEnd) {
        const newRecord = {
          reason: violationReason,
          start: penaltyStart, // 這裡保留本地時間字串給紀錄看
          end: penaltyEnd,
          note: violationText,
          saved_at: new Date().toISOString()
        };
        if (updatedHistory.length === 0 || updatedHistory[0].start !== penaltyStart) {
            updatedHistory = [newRecord, ...updatedHistory];
        }
      }

      const { error } = await supabase
        .from('users')
        .update({ 
          violation_log: violationText,
          violation_reason: violationReason,
          penalty_start: saveStart,
          penalty_end: saveEnd,
          violation_history: updatedHistory
        })
        .eq('id', currentViolationUser.id);
      
      if (error) throw error;
      
      alert('違規與處罰設定已儲存');
      setShowViolationModal(false);
      setCurrentViolationUser(null);
      await loadUsers();
    } catch (error) {
      console.error('儲存違規事項失敗:', error);
      alert('儲存失敗，請稍後再試');
    }
  };

  // === 計費相關輔助元件 (包含連續優惠邏輯 + 修正為小數點 2 位) ===
  const BillingModal = () => {
    
    // 1. 將單個預約轉換為標準的開始與結束時間物件 (單位：分鐘)
    const parseBookingTime = (dateStr, timeSlot) => {
      const [start, end] = timeSlot.split('-');
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      
      const startTime = new Date(`${dateStr}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00`);
      let endTime = new Date(`${dateStr}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00`);
      
      if (endH < startH || (endH === startH && endM < startM)) {
         endTime.setDate(endTime.getDate() + 1);
      }

      return {
        start: startTime.getTime(),
        end: endTime.getTime(),
        durationHours: (endTime - startTime) / (1000 * 60 * 60)
      };
    };

    // 2. 整理每個 Lab 和用戶的數據，並計算連續優惠
    const billingData = useMemo(() => {
      const data = {};
      labs.forEach(lab => {
        data[lab.name] = { totalHours: 0, totalBillableHours: 0, users: {} };
      });

      const bookingsByUser = {};
      historyBookings.forEach(booking => {
        const userName = booking.display_name;
        if (!bookingsByUser[userName]) {
            bookingsByUser[userName] = { lab: booking.pi, bookings: [] };
        }
        bookingsByUser[userName].bookings.push(booking);
      });

      Object.entries(bookingsByUser).forEach(([userName, userInfo]) => {
          const labName = userInfo.lab;
          
          if (!data[labName]) {
             data[labName] = { totalHours: 0, totalBillableHours: 0, users: {} };
          }
          if (!data[labName].users[userName]) {
              data[labName].users[userName] = { 
                  totalHours: 0, 
                  billableHours: 0, 
                  discountCount: 0 
              };
          }

          const userBookings = userInfo.bookings.sort((a, b) => {
              const timeA = parseBookingTime(a.date, a.time_slot).start;
              const timeB = parseBookingTime(b.date, b.time_slot).start;
              return timeA - timeB;
          });

          let currentBlockDuration = 0;
          let lastEndTime = null;

          userBookings.forEach((booking, index) => {
              const { start, end, durationHours } = parseBookingTime(booking.date, booking.time_slot);
              
              if (lastEndTime !== null && start === lastEndTime) {
                  currentBlockDuration += durationHours;
              } else {
                  if (currentBlockDuration > 0) {
                      const discountBlocks = Math.floor(currentBlockDuration / 12);
                      const billable = currentBlockDuration - (discountBlocks * 2);
                      data[labName].users[userName].billableHours += billable;
                      data[labName].users[userName].discountCount += discountBlocks;
                  }
                  currentBlockDuration = durationHours;
              }
              
              lastEndTime = end;
              data[labName].users[userName].totalHours += durationHours;

              if (index === userBookings.length - 1) {
                  const discountBlocks = Math.floor(currentBlockDuration / 12);
                  const billable = currentBlockDuration - (discountBlocks * 2);
                  data[labName].users[userName].billableHours += billable;
                  data[labName].users[userName].discountCount += discountBlocks;
              }
          });

          data[labName].totalHours += data[labName].users[userName].totalHours;
          data[labName].totalBillableHours += data[labName].users[userName].billableHours;
      });

      return data;
    }, [historyBookings, labs]);

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
        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[80vh] flex overflow-hidden relative">
          
          {/* === 右上角大 X 關閉按鈕 === */}
          <button 
             onClick={() => setShowBillingModal(false)}
             className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition z-10"
             title="關閉視窗"
          >
             <X className="w-5 h-5 text-gray-500" />
          </button>
          
          {/* 左側控制區 */}
          <div className="w-1/3 bg-gray-50 p-6 border-r flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
              <DollarSign className="w-6 h-6 text-green-600" />
              計費設定
            </h2>

            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-2">選擇計費月份</label>
               <input
                 type="month"
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(e.target.value)}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
               />
            </div>
            
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
               <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-600">說明：連續使用 12 小時，僅收 10 小時費用。</p>
               </div>
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
          <div className="w-2/3 p-6 overflow-y-auto pt-12">
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
    const totalCost = data.totalBillableHours * rate;

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
                <p className="text-sm text-gray-500">
                    計費 {data.totalBillableHours.toFixed(2)} hr 
                    <span className="text-xs text-gray-400 ml-1">(實際 {data.totalHours.toFixed(2)} hr)</span>
                </p>
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
                  <th className="px-4 py-2 text-right">實際/計費時數</th>
                  <th className="px-4 py-2 text-left">優惠標記</th>
                  <th className="px-4 py-2 text-right">費用</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(data.users).map(([user, info]) => (
                  <tr key={user}>
                    <td className="px-4 py-2 font-medium">{user}</td>
                    <td className="px-4 py-2 text-right">
                        <span className="text-gray-400 text-xs mr-2">{info.totalHours.toFixed(2)}</span>
                        <span className="font-bold">{info.billableHours.toFixed(2)} hr</span>
                    </td>
                    <td className="px-4 py-2 text-left">
                        {info.discountCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                                <Zap className="w-3 h-3" />
                                優惠: {info.discountCount}次
                            </span>
                        )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">
                      ${Math.round(info.billableHours * rate).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {Object.keys(data.users).length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-2 text-center text-gray-400">本月無使用紀錄</td></tr>
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
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
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
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border-t-4 border-yellow-500 max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileWarning className="w-6 h-6 text-yellow-600" />
              違規與處罰管理
            </h2>
            <button onClick={() => setShowViolationModal(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="overflow-y-auto pr-2 flex-1 space-y-6">
            {/* 用戶資訊 */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-gray-800 font-medium">用戶: {currentViolationUser.display_name} ({currentViolationUser.username})</p>
              <p className="text-sm text-gray-500">Lab: {currentViolationUser.pi}</p>
            </div>

            {/* 當前處罰設定 */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 space-y-4">
              <h3 className="font-bold text-yellow-800 border-b border-yellow-200 pb-2">當前處罰設定</h3>
              
              {/* 下拉式選單區塊 (從系統設定動態讀取) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選擇處罰事項 (從系統設定讀取)</label>
                <select 
                  onChange={handleSelectPreset}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white mb-2"
                >
                  <option value="manual">-- 請選擇或手動輸入 --</option>
                  {violationPresets && violationPresets.map((preset, index) => (
                    <option key={index} value={index}>{preset.reason} (停權 {preset.days} 天)</option>
                  ))}
                </select>
                
                <input 
                  type="text" 
                  value={violationReason} 
                  onChange={(e) => setViolationReason(e.target.value)} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white" 
                  placeholder="手動輸入或修改違規事項內容..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">處罰開始時間</label>
                  <input type="datetime-local" value={penaltyStart} onChange={(e) => setPenaltyStart(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm bg-white"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">處罰結束時間</label>
                  <input type="datetime-local" value={penaltyEnd} onChange={(e) => setPenaltyEnd(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm bg-white"/>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內部備註 (僅管理員可見)</label>
                <textarea value={violationText} onChange={(e) => setViolationText(e.target.value)} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white" placeholder="詳細情況..."/>
              </div>
            </div>

           {/* 歷史紀錄列表 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">📜 歷史懲罰紀錄</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                {violationHistory && violationHistory.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {violationHistory.map((record, index) => (
                      <li key={index} className="p-3 hover:bg-gray-50 transition">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <span className="font-medium text-red-600">{record.reason}</span>
                            <span className="text-xs text-gray-400 ml-2">建立於: {new Date(record.saved_at).toLocaleDateString('zh-TW')}</span>
                          </div>
                          
{/* [新增] 一鍵恢復按鈕 (自動更新時間至現在) */}
                          <button 
                            onClick={() => {
                              setViolationReason(record.reason);
                              setViolationText(record.note || '');
                              
                              // 計算這筆舊紀錄原本處罰了多久
                              const oldStart = new Date(record.start);
                              const oldEnd = new Date(record.end);
                              const duration = oldEnd.getTime() - oldStart.getTime(); 
                              
                              // 將時間平移到「現在」開始
                              const now = new Date();
                              const newEnd = new Date(now.getTime() + duration);
                              
                              // 轉換為本地時間格式填入輸入框
                              const toLocalISO = (date) => {
                                const offset = date.getTimezoneOffset() * 60000;
                                return new Date(date - offset).toISOString().slice(0, 16);
                              };

                              setPenaltyStart(toLocalISO(now));
                              setPenaltyEnd(toLocalISO(newEnd));
                              
                              alert('✅ 已為您載入舊紀錄！\n系統已自動將處罰時間設定為「從現在開始」。\n請確認無誤後點擊下方儲存！');
                            }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          >
                            🔄 恢復此紀錄
                          </button>
                        </div>
                        <p className="text-sm text-gray-600">期間：{record.start.replace('T', ' ')} ~ {record.end.replace('T', ' ')}</p>
                        {record.note && <p className="text-sm text-gray-500 mt-1 bg-gray-100 p-1.5 rounded">備註: {record.note}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">尚無歷史懲罰紀錄</p>
                )}
              </div>
            </div>

</div> {/* 🔴 補回這個遺失的結尾標籤，關閉滾動視窗 */}

              {/* 底部按鈕區 */}
              <div className="flex gap-3 mt-4 pt-4 border-t flex-shrink-0">
                <button onClick={handleClearPenalty} className="px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">解除 / 清空</button>
                <button onClick={() => setShowViolationModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">取消</button>
                <button onClick={handleSaveViolation} className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium flex items-center justify-center gap-2 shadow-lg shadow-yellow-200">
                  <Save className="w-4 h-4" />
                  儲存並更新紀錄
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
            
            {/* 左側：編輯使用規則 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-2">編輯使用規則</h2>
              <p className="text-sm text-gray-600 mb-6">修改登入頁面右側顯示的使用規則文字</p>
              {systemSettings && (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <div key={num}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">規則 {num}</label>
                      <textarea value={systemSettings[`rule${num}`]} onChange={(e) => setSystemSettings({ ...systemSettings, [`rule${num}`]: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-y" placeholder={`輸入規則 ${num} 的內容...`}/>
                    </div>
                  ))}
                  <button onClick={handleSaveSettings} className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-lg shadow-indigo-200">儲存所有設定</button>
                </div>
              )}
            </div>

            {/* 右側：預覽與自訂處罰模板 */}
            <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              
{/* 自訂處罰模板區塊 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-2">處罰事項管理</h2>
                <p className="text-sm text-gray-600 mb-4">設定後，違規視窗的下拉選單就會自動出現對應選項</p>
                
                {/* 新增模板輸入框 */}
                <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <input type="text" value={newPresetReason} onChange={(e)=>setNewPresetReason(e.target.value)} placeholder="違規名稱 (例: 預約未到)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input type="number" value={newPresetDays} onChange={(e)=>setNewPresetDays(e.target.value)} placeholder="停權天數" min="1" className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <button 
                    onClick={() => {
                      if(newPresetReason && newPresetDays) {
                        setViolationPresets([...(violationPresets || []), { reason: newPresetReason, days: parseInt(newPresetDays) }]);
                        setNewPresetReason(''); setNewPresetDays('');
                      }
                    }} 
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium whitespace-nowrap">
                    新增
                  </button>
                </div>

                {/* 現有模板列表 */}
                <div className="space-y-2">
                  {violationPresets && violationPresets.map((preset, index) => (
                    <div key={index} className="flex justify-between items-center px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <span className="text-sm font-medium text-gray-800">{preset.reason} (停權 {preset.days} 天)</span>
                      <button onClick={() => setViolationPresets(violationPresets.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!violationPresets || violationPresets.length === 0) && <p className="text-sm text-gray-500 text-center py-2">目前無自訂處罰事項</p>}
                </div>
                <p className="text-xs text-red-500 mt-4 font-medium">* 編輯或新增項目後，請務必點擊左下方「儲存所有設定」按鈕寫入資料庫。</p>
              </div>

              {/* 規則預覽區塊 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-2">登入頁規則預覽</h2>
                <div className="bg-indigo-600 text-white p-6 rounded-lg max-h-[300px] overflow-y-auto">
                  <div className="space-y-3">
                    {systemSettings && [1, 2, 3, 4, 5, 6, 7].map(num => (
                      systemSettings[`rule${num}`] && (
                        <div key={num} className="flex items-start gap-3"><Check className="w-5 h-5 mt-0.5 flex-shrink-0" /><p className="text-sm whitespace-pre-wrap">{systemSettings[`rule${num}`]}</p></div>
                      )
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // === Lab Management Panel ===
  if (showLabManagementPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Lab 管理</h1>
            <div className="flex gap-3">
              <button onClick={() => setShowAddLabModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"><UserPlus className="w-4 h-4" />新增 Lab</button>
              <button onClick={() => setShowLabManagementPanel(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"><X className="w-4 h-4" />返回</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {labs.map(lab => {
                const usersCount = users.filter(u => u.pi === lab.name).length;
                return (
                  <div key={lab.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{lab.name}</p>
                        {lab.description && <p className="text-sm text-gray-600">{lab.description}</p>}
                        <p className="text-xs text-gray-500 mt-1">{usersCount} 個用戶使用中</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingLab({...lab}); setShowEditLabModal(true); }} className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm">編輯</button>
                      <button onClick={() => handleDeleteLab(lab.id, lab.name)} disabled={usersCount > 0} className={`flex-1 px-3 py-1 rounded-lg transition text-sm ${usersCount > 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>刪除</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {labs.length === 0 && <div className="text-center py-12 text-gray-500">暫無 Lab 資料，請點擊右上角「新增 Lab」</div>}
          </div>
        </div>
      </div>
    );
  }

  if (showHistoryPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">歷史預約記錄</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBillingModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
              >
                <DollarSign className="w-4 h-4" />
                計費報表
              </button>
              <button
                onClick={() => setShowClearHistoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
              >
                <Trash2 className="w-4 h-4" />
                清除舊資料
              </button>

              <button
                onClick={exportToCSV}
                disabled={historyBookings.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  historyBookings.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                <Check className="w-4 h-4" />
                匯出 CSV
              </button>
              
              <button onClick={() => setShowHistoryPanel(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"><X className="w-4 h-4" />返回</button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">選擇月份：</label>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/>
              <span className="text-sm text-gray-600">{historyBookings.length} 筆記錄</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">預約時間</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用戶</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">實驗室</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">儀器</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時段</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historyBookings.map(booking => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(booking.booked_at).toLocaleString('zh-TW')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{booking.display_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.pi} Lab</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.instrument} MHz</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.time_slot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyBookings.length === 0 && (
              <div className="text-center py-12 text-gray-500">{selectedMonth ? `${selectedMonth} 無預約記錄` : '請選擇月份查看記錄'}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showAdminPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">用戶管理</h1>
            <div className="flex gap-3">
              <button onClick={() => setShowLabManagementPanel(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition"><Settings className="w-4 h-4" />Lab 管理</button>
              <button onClick={() => setShowAddUserModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"><UserPlus className="w-4 h-4" />新增用戶</button>
              <button onClick={() => setShowAdminPanel(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"><X className="w-4 h-4" />返回</button>
            </div>
          </div>
        </div>
        
<div className="max-w-7xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            
            {/* 新增的 Lab 過濾選單 */}
            <div className="mb-6 flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 w-full md:w-1/2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">過濾實驗室：</label>
              <select
                value={selectedLabFilter}
                onChange={(e) => setSelectedLabFilter(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="">顯示全部用戶 (All)</option>
                {labs.map(lab => (
                  <option key={lab.id} value={lab.name}>{lab.name} Lab</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {users
                .filter(user => selectedLabFilter === '' || user.pi === selectedLabFilter)
                .map(user => (
                <div key={user.id} className={`border rounded-lg p-4 ${!user.active ? 'bg-gray-50 opacity-75' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
<div className="flex items-center gap-2">
  <p className="font-semibold text-lg">{user.display_name}</p>
  {(() => {
    const now = new Date();
    const pStart = user.penalty_start ? new Date(user.penalty_start) : null;
    const pEnd = user.penalty_end ? new Date(user.penalty_end) : null;
    const isPenalized = pStart && pEnd && now >= pStart && now <= pEnd;

    // 依序判斷：如果在處罰時間內 -> 顯示黃色「停權中」
    if (isPenalized) return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold">停權中</span>;
    // 若被手動關閉 -> 顯示紅色「已停用」
    if (user.active === false) return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">已停用</span>;
    // 正常狀態 -> 顯示綠色「已啟用」
    return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">已啟用</span>;
  })()}
  {user.is_admin && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">管理員</span>}
</div>
                      <p className="text-sm text-gray-600">{user.username} - {user.pi} Lab</p>
                    </div>
                    
                    <div className="flex gap-2">
                       <button
                        onClick={() => openViolationModal(user)}
                        className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition text-sm"
                      >
                        <FileWarning className="w-3 h-3" />
                        違規
                      </button>

                      <button onClick={() => { setEditingUser({...user, password: ''}); setShowEditUserModal(true); }} className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"><Edit className="w-3 h-3" />編輯</button>
                      <button onClick={() => toggleUserActive(user.id, user.active !== false)} className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition text-sm ${user.active !== false ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {user.active !== false ? <><UserX className="w-3 h-3" />停用</> : <><UserCheck className="w-3 h-3" />啟用</>}
                      </button>
                      <button onClick={() => handleDeleteUser(user.id, user.username)} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"><Trash2 className="w-3 h-3" />刪除</button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {INSTRUMENTS.map(instrument => (
                      <button
                        key={instrument}
                        onClick={() => toggleUserInstrument(user.id, instrument)}
                        disabled={user.active === false}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          user.active === false
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : user.instruments?.includes(instrument)
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {instrument} MHz {user.instruments?.includes(instrument) ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">NMR預約系統</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-600" />
                <span className="font-medium">{currentUser?.display_name}</span>
                <span className="text-gray-500">({currentUser?.pi} Lab)</span>
              </div>
              {currentUser?.is_admin && (
                <>
                  <button onClick={() => setShowAdminPanel(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm"><Settings className="w-4 h-4" />用戶管理</button>
                  <button onClick={() => setShowHistoryNotice(true)} className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm"><Calendar className="w-4 h-4" />歷史記錄</button>
                  <button onClick={() => setShowTimeSlotPanel(true)} className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm"><Clock className="w-4 h-4" />時段設定</button>
                  <button onClick={() => setShowSettingsPanel(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"><Settings className="w-4 h-4" />系統設定</button>
                </>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"><LogOut className="w-4 h-4" />登出 Logout</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇儀器 Select Instrument</label>
              <select value={selectedInstrument} onChange={(e) => setSelectedInstrument(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="">請選擇儀器 Please select</option>
                {currentUser?.instruments?.length === 0 ? (<option disabled>您尚無儀器使用權限 No instrument permission</option>) : (currentUser?.instruments?.map(instrument => (<option key={instrument} value={instrument}>{instrument} MHz NMR</option>)))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇日期 Select Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={getTodayString()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
            </div>
          </div>
        </div>

        {selectedInstrument && selectedDate ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">{selectedInstrument} MHz - {selectedDate}</h2>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-gray-500">載入中...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {timeSlots.map(slot => {
                  const booking = getBookingForSlot(slot);
                  const isPast = isTimePassed(selectedDate, slot);
                  const isMyBooking = booking && booking.username === currentUser.username;

                  return (
                    <div key={slot} className={`border rounded-lg p-3 transition ${isPast ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : booking ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50 cursor-pointer border-gray-300'}`} onClick={() => !booking && !isPast && handleBooking(slot)}>
                      <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4" /><span className="font-medium text-xs">{slot}</span></div>
                      {booking ? (
                        <div className="text-xs">
                          <p className="font-semibold">{booking.display_name}</p>
                          <p className="text-gray-600">{booking.pi} Lab</p>
                          {isMyBooking && !isPast && (
                            <button onClick={(e) => { e.stopPropagation(); handleCancelBooking(booking.id, slot); }} className="mt-2 w-full px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition">取消 Cancel</button>
                          )}
                        </div>
                      ) : (!isPast && <p className="text-xs text-gray-500">可預約<br/>Available</p>)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">請選擇儀器和日期以查看可預約時段</p>
            <p className="text-gray-400 text-sm mt-2">Please select instrument and date to view available time slots</p>
          </div>
        )}
      </div>
    </div>
  );
}