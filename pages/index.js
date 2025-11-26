import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, LogOut, Settings, X, Check, AlertCircle, UserCheck, UserX, UserPlus, Trash2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase'; // 確保這個路徑是正確的

// 輔助函式：取得今天的日期字串 (YYYY-MM-DD)
const getTodayString = () => {
  const today = new Date();
  // 使用 toISOString 並截斷，確保格式正確
  return today.toISOString().split('T')[0];
};

// 輔助函式：將 HH:MM 轉換為總分鐘數 (用於 generateTimeSlots)
const parseTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m; // 轉換為總分鐘數
};

export default function NMRBookingSystem() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  // 【新增狀態】：控制歷史記錄提醒視窗
  const [showHistoryNotice, setShowHistoryNotice] = useState(false); 
  
  // 修正：只保留一組 loginForm 定義
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
  // 確保 timeSlotSettings 是從資料庫載入的
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

  // 新增狀態：選擇要清理的截止年份 (預設為當前年份 - 3)
  const currentYear = new Date().getFullYear();
  const [cleanupYear, setCleanupYear] = useState(currentYear - 3);


  // 儀器列表 - 統一管理
  const INSTRUMENTS = ['60', '500'];

  // ===============================================
  // 修正後的動態時段生成函式 (使用 useMemo 以避免重複計算)
  // ===============================================
  const generateTimeSlots = useCallback(() => {
    if (!timeSlotSettings) return [];
    
    const slots = [];
    const { day_start, day_end, day_interval, night_start, night_end, night_interval } = timeSlotSettings;

    const formatTime = (minutes) => {
      const h = Math.floor(minutes / 60) % 24;
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // 1. 生成日間時段 (Day Period)
    let dayStartMin = parseTime(day_start);
    let dayEndMin = parseTime(day_end);

    // 假設日間時段不會跨日 (09:00 - 18:00)
    for (let current = dayStartMin; current < dayEndMin; current += day_interval) {
      const end = current + day_interval;
      slots.push(`${formatTime(current)}-${formatTime(end)}`);
    }

    // 2. 生成夜間時段 (Night Period) - 處理跨日邏輯 (18:00 - 隔天 09:00)
    let nightStartMin = parseTime(night_start);
    let nightEndMin = parseTime(night_end) + (parseTime(night_end) < parseTime(night_start) ? 24 * 60 : 0); // 如果結束時間小於開始時間，則為隔天

    for (let current = nightStartMin; current < nightEndMin; current += night_interval) {
      const end = current + night_interval;
      slots.push(`${formatTime(current)}-${formatTime(end)}`);
    }

    // 清理和排序 (雖然邏輯上應該不會有重複，但以防萬一)
    const uniqueSlots = Array.from(new Set(slots));
    
    // 排序 (依時間先後)
    uniqueSlots.sort((a, b) => {
        const [aStart] = a.split('-');
        const [bStart] = b.split('-');
        return parseTime(aStart) - parseTime(bStart);
    });

    return uniqueSlots;

  }, [timeSlotSettings]);

  // 修正：刪除重複定義，只保留此行
  const timeSlots = useMemo(() => generateTimeSlots(), [generateTimeSlots]);
  
  // ===============================================
  // 資料載入函式 (useCallback 優化)
  // ===============================================

  // 載入預約
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
  }, [selectedInstrument, selectedDate]); // 依賴項

  // 載入用戶
  const loadUsers = useCallback(async () => {
    try {
      // 建議: 可以在這裡添加一次額外查詢，確保 Lab 刪除時檢查數據最新
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('載入用戶失敗:', error);
    }
  }, []); // 無外部依賴項

  // 載入歷史預約
  const loadHistoryBookings = useCallback(async (month) => {
    try {
      if (!month) {
        setHistoryBookings([]);
        return;
      }

      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      
      // 計算該月最後一天
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
  }, []); // 無外部依賴項


  // ===============================================
  // useEffect 區塊
  // ===============================================

  // 載入系統初始化設定 (只執行一次)
  useEffect(() => {
    loadSystemSettings();
    loadLabs();
    loadTimeSlotSettings();
  }, []); // 只有第一次載入

  // 載入預約/用戶 (依賴登入狀態、儀器、日期)
  useEffect(() => {
    if (isLoggedIn) {
      loadBookings();
      if (currentUser?.is_admin) {
        loadUsers();
      }
    }
  }, [isLoggedIn, selectedInstrument, selectedDate, loadBookings, currentUser, loadUsers]); // 確保 loadBookings 和 loadUsers 在依賴項中

  // 設定預設日期
  useEffect(() => {
    if (isLoggedIn && !selectedDate) {
      setSelectedDate(getTodayString());
    }
  }, [isLoggedIn, selectedDate]);

  // 歷史紀錄面板初始化當前月份及載入資料 (依賴面板顯示狀態和月份)
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


  // ===============================================
  // 資料庫操作和邏輯 (loadSystemSettings, loadTimeSlotSettings, handleLogin 等)
  // ===============================================

  const loadSystemSettings = async () => {
    // 保持原樣
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('載入設定錯誤:', error);
      }
      
      if (data) {
        setSystemSettings(data);
      } else {
        const defaultSettings = {
          rule1: '請提前預約所需時段，系統開放預約未來時段',
          rule2: '不可預約或取消已過去的時間',
          rule3: '預約時間粒度為15分鐘（09:00-18:00）及30分鐘（18:00-09:00）',
          rule4: '請準時使用儀器，並保持儀器清潔',
          rule5: '使用前請確認已通過該儀器操作訓練',
          rule6: '如有問題請聯絡管理員',
          rule7: ''
        };
        setSystemSettings(defaultSettings);
      }
    } catch (error) {
      console.error('載入系統設定失敗:', error);
      const defaultSettings = {
        rule1: '請提前預約所需時段，系統開放預約未來時段',
        rule2: '不可預約或取消已過去的時間',
        rule3: '預約時間粒度為15分鐘（09:00-18:00）及30分鐘（18:00-09:00）',
        rule4: '請準時使用儀器，並保持儀器清潔',
        rule5: '使用前請確認已通過該儀器操作訓練',
        rule6: '如有問題請聯絡管理員',
        rule7: ''
      };
      setSystemSettings(defaultSettings);
    }
  };

  const loadTimeSlotSettings = async () => {
    // 保持原樣
    try {
      const { data, error } = await supabase
        .from('timeslot_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('載入時段設定錯誤:', error);
      }
      
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
  };

  const loadLabs = async () => {
    // 保持原樣
    try {
      const { data, error } = await supabase
        .from('labs')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setLabs(data || []);
    } catch (error) {
      console.error('載入 Lab 列表失敗:', error);
    }
  };

  const handleLogin = async () => {
    // 保持原樣 (但強烈建議修改為更安全的驗證方式)
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
    // 保持原樣
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
    // 保持原樣
    const now = new Date();
    const selectedDateTime = new Date(date);
    
    const startTime = timeSlot.split('-')[0];
    const [hour, minute] = startTime.split(':').map(Number);
    selectedDateTime.setHours(hour, minute, 0, 0);
    
    return selectedDateTime < now;
  };

  const handleBooking = async (timeSlot) => {
    // 保持原樣
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
    // 保持原樣
    if (isTimePassed(selectedDate, timeSlot)) {
      alert('不可取消已過去的預約\nCannot cancel past bookings');
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      alert('已取消預約\nBooking cancelled');
      await loadBookings();
    } catch (error) {
      console.error('取消失敗:', error);
      alert('取消失敗，請稍後再試\nCancellation failed, please try again later');
    }
  };

  const toggleUserInstrument = async (userId, instrument) => {
    // 保持原樣
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
    // 保持原樣
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
    // 保持原樣
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
          active: true
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
    // 保持原樣
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

  // 處理刪除用戶 (保留預約紀錄)
  const handleDeleteUser = async (userId, username) => {
    // 這裡使用 window.confirm 代替原本的 confirm (在 Canvas 環境中)
    if (!window.confirm(`確定要刪除用戶 "${username}" 嗎？此操作無法復原，但其預約紀錄將會保留。`)) {
      return;
    }

    try {
      // **移除：刪除預約記錄的邏輯 (確保保留紀錄)**
      
      // 刪除用戶
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      alert('用戶已刪除，但其歷史預約紀錄已保留。'); // 更改提示訊息
      await loadUsers();
    } catch (error) {
      console.error('刪除用戶失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  // 新增：清除歷史記錄的函式
  const handleClearHistory = async () => {
    if (!currentUser?.is_admin || !cleanupYear) {
      alert('清理失敗: 請選擇要清理的截止年份。');
      return;
    }

    // 截止日期設定為所選年份的下一年的第一天 (即刪除早於該年 12/31 的所有數據)
    const cutoffDate = new Date(Number(cleanupYear), 0, 1);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    // 安全確認
    const confirmMessage = `警告：您即將刪除 ${cutoffDateString} 之前的「所有」預約記錄。\n\n此操作僅會清除預約歷史，不會刪除任何用戶帳號。\n\n是否確定繼續？`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // 二次確認 (防止手滑)
    if (!window.confirm('請再次確認：刪除後的資料無法復原。確定要執行嗎？')) {
      return;
    }

    setLoading(true);
    try {
      // Supabase 刪除操作：刪除 bookings 表中日期小於指定年份 1月1日 的資料
      const { error, count } = await supabase
        .from('bookings')
        .delete({ count: 'exact' }) // 要求回傳刪除筆數
        .lt('date', cutoffDateString);

      if (error) throw error;

      alert(`清理完成！已刪除 ${count || 0} 筆早於 ${cleanupYear} 年的舊記錄。`);
      
      // 重新載入當前歷史列表（如果有顯示的話）
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
    // 保持原樣
    if (!systemSettings) return;

    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('id', 1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            rule1: systemSettings.rule1,
            rule2: systemSettings.rule2,
            rule3: systemSettings.rule3,
            rule4: systemSettings.rule4,
            rule5: systemSettings.rule5,
            rule6: systemSettings.rule6,
            rule7: systemSettings.rule7
          })
          .eq('id', 1);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert([{
            id: 1,
            ...systemSettings
          }]);

        if (error) throw error;
      }

      alert('設定已儲存！');
    } catch (error) {
      console.error('儲存設定失敗:', error);
      alert('儲存失敗，請稍後再試');
    }
  };

  const handleSaveTimeSlotSettings = async () => {
    // 保持原樣
    if (!timeSlotSettings) return;

    try {
      const { data: existing } = await supabase
        .from('timeslot_settings')
        .select('id')
        .eq('id', 1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('timeslot_settings')
          .update({
            day_start: timeSlotSettings.day_start,
            day_end: timeSlotSettings.day_end,
            day_interval: timeSlotSettings.day_interval,
            night_start: timeSlotSettings.night_start,
            night_end: timeSlotSettings.night_end,
            night_interval: timeSlotSettings.night_interval
          })
          .eq('id', 1);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('timeslot_settings')
          .insert([{
            id: 1,
            ...timeSlotSettings
          }]);

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
    // 保持原樣
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
    link.setAttribute('download', `預約記錄_${selectedMonth}.csv`);    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    document.body.removeChild(link);
  };

  const handleAddLab = async () => {
    // 保持原樣
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
        if (error.code === '23505') {
          alert('此 Lab 名稱已存在');
        } else {
          throw error;
        }
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
    // 保持原樣
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
        if (error.code === '23505') {
          alert('此 Lab 名稱已存在');
        } else {
          throw error;
        }
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
    // 修復潛在 Bug：確保 users 數據是最新或直接在後端檢查
    // 這裡我們在執行刪除前，先強制載入一次最新的 users 列表，確保檢查準確性。
    await loadUsers(); 
    const currentUsers = users.length > 0 ? users : (await supabase.from('users').select('*')).data || [];

    const usersWithLab = currentUsers.filter(u => u.pi === labName);
    if (usersWithLab.length > 0) {
      alert(`無法刪除：有 ${usersWithLab.length} 個用戶使用此 Lab`);
      return;
    }

    // 這裡使用 window.confirm 代替原本的 confirm (在 Canvas 環境中)
    if (!window.confirm(`確定要刪除 Lab "${labName}" 嗎？`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('labs')
        .delete()
        .eq('id', labId);

      if (error) throw error;

      alert('Lab 已刪除');
      await loadLabs();
    } catch (error) {
      console.error('刪除 Lab 失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };


  const toggleNewUserInstrument = (instrument) => {
    // 保持原樣
    const current = newUserForm.instruments;
    if (current.includes(instrument)) {
      setNewUserForm({
        ...newUserForm,
        instruments: current.filter(i => i !== instrument)
      });
    } else {
      setNewUserForm({
        ...newUserForm,
        instruments: [...current, instrument]
      });
    }
  };

  const getBookingForSlot = (timeSlot) => {
    // 保持原樣
    return bookings.find(b => b.time_slot === timeSlot);
  };
// 登入畫面
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
                  <>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>請提前預約所需時段，系統開放預約未來時段</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>不可預約或取消已過去的時間</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>預約時間粒度為15分鐘（09:00-18:00）及30分鐘（18:00-09:00）</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>請準時使用儀器，並保持儀器清潔</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>使用前請確認已通過該儀器操作訓練</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>如有問題請聯絡管理員</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 登入後的通知
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
                <li className="list-none">
                  • 請勿預約已過去的時段<br/>
                  <span className="ml-3">Do not book past time slots</span>
                </li>
                <li className="list-none">
                  • 預約後請準時使用<br/>
                  <span className="ml-3">Please use the equipment on time</span>
                </li>
                <li className="list-none">
                  • 使用完畢請保持儀器清潔<br/>
                  <span className="ml-3">Keep the equipment clean after use</span>
                </li>
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

  // ===============================================
  // 【新增：歷史記錄提醒視窗】 - 修復後版本
  // ===============================================
  if (showHistoryNotice && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            {/* 使用藍色提醒圖示取代綠色 Check */}
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">歷史記錄管理提醒</h2>
            <p className="text-gray-600 mb-6">數據維護是管理員的重要職責。</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-700 mb-3"><strong>數據維護注意事項 Notes:</strong></p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="list-none text-red-700 font-semibold">
                  {/* 清理後的文本 */}
                  • 因後臺容量有限，記得**每年一月清理數據一次**！<br/>
                  <span className="ml-3 font-normal text-red-600">Please perform annual data cleanup (Settings &gt; Time Slot)</span>
                </li>
                <li className="list-none">
                  • 手動刪除帳號會**保留**其歷史預約記錄。
                </li>
                <li className="list-none">
                  • 選擇月份，下載歷史記錄即可得到**選擇月份的預約紀錄**。
                </li>
              </ul>
            </div>
            
            <button
              onClick={() => {
                setShowHistoryNotice(false);
                setShowHistoryPanel(true); // 點擊按鈕後，跳轉到歷史記錄畫面
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
  // ===============================================


  // 新增 Lab 彈窗
  if (showAddLabModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">新增 Lab</h2>
            <button onClick={() => setShowAddLabModal(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label>
              <input
                type="text"
                value={newLabForm.name}
                onChange={(e) => setNewLabForm({...newLabForm, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：chen123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">描述（選填）</label>
              <input
                type="text"
                value={newLabForm.description}
                onChange={(e) => setNewLabForm({...newLabForm, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：有機化學實驗室"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowAddLabModal(false)}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              取消
            </button>
            <button
              onClick={handleAddLab}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              新增
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 編輯用戶彈窗
  if (showEditUserModal && editingUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">編輯用戶</h2>
            <button onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">帳號</label>
              <input
                type="text"
                value={editingUser.username}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">帳號無法修改</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">新密碼（留空表示不修改）</label>
              <input
                type="text"
                value={editingUser.password || ''}
                onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="輸入新密碼或留空"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">顯示名稱 *</label>
              <input
                type="text"
                value={editingUser.display_name}
                onChange={(e) => setEditingUser({...editingUser, display_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label>
              <select
                value={editingUser.pi}
                onChange={(e) => setEditingUser({...editingUser, pi: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">請選擇 Lab</option>
                {labs.map(lab => (
                  <option key={lab.id} value={lab.name}>{lab.name} {lab.description && `(${lab.description})`}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_is_admin"
                checked={editingUser.is_admin}
                onChange={(e) => setEditingUser({...editingUser, is_admin: e.target.checked})}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="edit_is_admin" className="text-sm text-gray-700">設為管理員</label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              取消
            </button>
            <button
              onClick={handleEditUser}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    );
  }
// 時段設定面板
  if (showTimeSlotPanel && currentUser?.is_admin) {
    // === 資料清理選項的年份回溯 ===
    const years = [];
    // 從當前年份回溯 5 年，以提供清理選項
    for (let y = currentYear - 1; y >= currentYear - 5; y--) {
        years.push(y);
    }
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">時段與資料清理設定</h1> {/* 更改標題 */}
            <button
              onClick={() => setShowTimeSlotPanel(false)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              <X className="w-4 h-4" />
              返回
            </button>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6"> 
            {/* 預約時段設定區塊 */}
            <div className="border-b pb-6">
                <h2 className="text-xl font-bold mb-4">預約時段設定</h2>
                <p className="text-sm text-gray-600 mb-6">設定日間和夜間的時段區間和間隔時間</p>
                
                {timeSlotSettings && (
                <div className="space-y-6">
                    <div className="border-b pb-6">
                    <h3 className="font-semibold text-lg mb-4">日間時段</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
                        <input
                            type="time"
                            value={timeSlotSettings.day_start}
                            onChange={(e) => setTimeSlotSettings({...timeSlotSettings, day_start: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">結束時間</label>
                        <input
                            type="time"
                            value={timeSlotSettings.day_end}
                            onChange={(e) => setTimeSlotSettings({...timeSlotSettings, day_end: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">時段間隔（分鐘）</label>
                        <select
                            value={timeSlotSettings.day_interval}
                            onChange={(e) => setTimeSlotSettings({...timeSlotSettings, day_interval: parseInt(e.target.value)})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                            <option value="15">15 分鐘</option>
                            <option value="30">30 分鐘</option>
                            <option value="60">60 分鐘</option>
                        </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        例如：09:00-18:00，每 15 分鐘一個時段
                    </p>
                    </div>

                    <div className="border-b pb-6">
                    <h3 className="font-semibold text-lg mb-4">夜間時段</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
                        <input
                            type="time"
                            value={timeSlotSettings.night_start}
                            onChange={(e) => setTimeSlotSettings({...timeSlotSettings, night_start: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">結束時間（隔天）</label>
                        <input
                            type="time"
                            value={timeSlotSettings.night_end}
                            onChange={(e) => setTimeSlotSettings({...timeSlotSettings, night_end: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">時段間隔（分鐘）</label>
                        <select
                            value={timeSlotSettings.night_interval}
                            onChange={(e) => setTimeSlotSettings({...timeSlotSettings, night_interval: parseInt(e.target.value)})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                            <option value="15">15 分鐘</option>
                            <option value="30">30 分鐘</option>
                            <option value="60">60 分鐘</option>
                        </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        例如：18:00-隔天09:00，每 30 分鐘一個時段
                    </p>
                    </div>
                    
                    <button
                    onClick={handleSaveTimeSlotSettings}
                    className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                    >
                    儲存時段設定
                    </button>
                </div>
                )}
            </div>

            {/* 資料清理區塊 - 新增內容 (使用原有樣式) */}
            <div className="border-t pt-6 mt-6 space-y-4"> 
                <h3 className="font-semibold text-lg mb-4 text-red-600">
                    歷史預約記錄清理
                </h3>
                <p className="text-sm text-gray-600">
                    請謹慎選擇截止年份，此操作將永久刪除所有早於所選年份底部的預約記錄。
                </p>
                
                <div className="flex items-center gap-4">
                    <label htmlFor="cleanupYear" className="text-sm font-medium text-gray-700">
                        刪除截止年份：
                    </label>
                    <select
                        id="cleanupYear"
                        value={cleanupYear}
                        onChange={(e) => setCleanupYear(Number(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                        <option value="">請選擇年份</option>
                        {/* 產生年份選項：從當前年份回溯 5 年 */}
                        {years.map(year => (
                            <option key={year} value={year}>早於 {year} 年底</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleClearHistory}
                    className={`w-full px-4 py-3 text-white font-bold rounded-lg shadow-md transition flex items-center justify-center ${loading || !cleanupYear ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    disabled={loading || !cleanupYear}
                >
                    {loading ? '清理中...' : `執行清理 (刪除早於 ${cleanupYear} 年底的數據)`}
                </button>
            </div>
            {/* 資料清理區塊結束 */}
          </div>
        </div>
      </div>
    );
  }

  // 系統設定面板
  if (showSettingsPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">系統設定</h1>
            <button
              onClick={() => setShowSettingsPanel(false)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              <X className="w-4 h-4" />
              返回
            </button>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        規則 {num}
                      </label>
                      <textarea
                        value={systemSettings[`rule${num}`]}
                        onChange={(e) => setSystemSettings({
                          ...systemSettings,
                          [`rule${num}`]: e.target.value
                        })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-y"
                        placeholder={`輸入規則 ${num} 的內容...`}
                      />
                    </div>
                  ))}
                  
                  <button
                    onClick={handleSaveSettings}
                    className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                  >
                    儲存設定
                  </button>
                </div>
              )}
            </div>

            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-2">即時預覽</h2>
                <p className="text-sm text-gray-600 mb-4">這是用戶在登入頁面看到的樣子</p>
                
                <div className="bg-indigo-600 text-white p-6 rounded-lg max-h-[600px] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4 sticky top-0 bg-indigo-600 pb-2">使用規則</h3>
                  <div className="space-y-3">
                    {systemSettings && [1, 2, 3, 4, 5, 6, 7].map(num => (
                      systemSettings[`rule${num}`] && (
                        <div key={num} className="flex items-start gap-3">
                          <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <p className="text-sm whitespace-pre-wrap">{systemSettings[`rule${num}`]}</p>
                        </div>
                      )
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    💡 提示：預覽區域可以上下滾動查看所有內容
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

// 歷史預約記錄面板
  if (showHistoryPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">歷史預約記錄</h1>
            <div className="flex gap-3">
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
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <X className="w-4 h-4" />
                返回
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-4">
          {/* 新增：月份選擇器 */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">選擇月份：</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600">
                {historyBookings.length} 筆記錄
              </span>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(booking.booked_at).toLocaleString('zh-TW')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.display_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.pi} Lab
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.instrument} MHz
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.time_slot}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyBookings.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {selectedMonth ? `${selectedMonth} 無預約記錄` : '請選擇月份查看記錄'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

// Lab 管理面板
  if (showLabManagementPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Lab 管理</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddLabModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <UserPlus className="w-4 h-4" />
                新增 Lab
              </button>
              <button
                onClick={() => setShowLabManagementPanel(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <X className="w-4 h-4" />
                返回
              </button>
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
                        {lab.description && (
                          <p className="text-sm text-gray-600">{lab.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{usersCount} 個用戶使用中</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingLab({...lab}); setShowEditLabModal(true); }}
                        className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDeleteLab(lab.id, lab.name)}
                        disabled={usersCount > 0}
                        className={`flex-1 px-3 py-1 rounded-lg transition text-sm ${
                          usersCount > 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {labs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                暫無 Lab 資料，請點擊右上角「新增 Lab」
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 管理員面板
  if (showAdminPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">用戶管理</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLabManagementPanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition"
              >
                <Settings className="w-4 h-4" />
                Lab 管理
              </button>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <UserPlus className="w-4 h-4" />
                新增用戶
              </button>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <X className="w-4 h-4" />
                返回
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className={`border rounded-lg p-4 ${!user.active ? 'bg-gray-50 opacity-75' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-lg">{user.display_name}</p>
                        {user.active === false && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">已停用</span>
                        )}
                        {user.active !== false && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">已啟用</span>
                        )}
                        {user.is_admin && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">管理員</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{user.username} - {user.pi} Lab</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingUser({...user, password: ''}); setShowEditUserModal(true); }}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                      >
                        <Edit className="w-3 h-3" />
                        編輯
                      </button>
                      <button
                        onClick={() => toggleUserActive(user.id, user.active !== false)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition text-sm ${
                          user.active !== false
                            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {user.active !== false ? (
                          <>
                            <UserX className="w-3 h-3" />
                            停用
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3 h-3" />
                            啟用
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        刪除
                      </button>
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

  // 主預約界面
  const timeSlots = useMemo(() => generateTimeSlots(), [generateTimeSlots]);

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
                  <button
                    onClick={() => setShowAdminPanel(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    用戶管理
                  </button>
                  <button
                    // 修改：點擊後先顯示提醒視窗
                    onClick={() => setShowHistoryNotice(true)} 
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    歷史記錄
                  </button>
                  <button
                    onClick={() => setShowTimeSlotPanel(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm"
                  >
                    <Clock className="w-4 h-4" />
                    時段設定
                  </button>
                  <button
                    onClick={() => setShowSettingsPanel(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    系統設定
                  </button>
                </>
              )}
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"
              >
                <LogOut className="w-4 h-4" />
                登出 Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇儀器 Select Instrument</label>
              <select
                value={selectedInstrument}
                onChange={(e) => setSelectedInstrument(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">請選擇儀器 Please select</option>
                {currentUser?.instruments?.length === 0 ? (
                  <option disabled>您尚無儀器使用權限 No instrument permission</option>
                ) : (
                  currentUser?.instruments?.map(instrument => (
                    <option key={instrument} value={instrument}>{instrument} MHz NMR</option>
                  ))
                )}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇日期 Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getTodayString()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {selectedInstrument && selectedDate ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">
              {selectedInstrument} MHz - {selectedDate}
            </h2>
            
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
                    <div
                      key={slot}
                      className={`border rounded-lg p-3 transition ${
                        isPast
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : booking
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white hover:bg-gray-50 cursor-pointer border-gray-300'
                      }`}
                      onClick={() => !booking && !isPast && handleBooking(slot)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium text-xs">{slot}</span>
                      </div>
                      
                      {booking ? (
                        <div className="text-xs">
                          <p className="font-semibold">{booking.display_name}</p>
                          <p className="text-gray-600">{booking.pi} Lab</p>
                          {isMyBooking && !isPast && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelBooking(booking.id, slot);
                              }}
                              className="mt-2 w-full px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition"
                            >
                              取消 Cancel
                            </button>
                          )}
                        </div>
                      ) : (
                        !isPast && <p className="text-xs text-gray-500">可預約<br/>Available</p>
                      )}
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