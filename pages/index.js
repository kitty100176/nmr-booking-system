import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, LogOut, Settings, X, Check, AlertCircle, UserCheck, UserX, UserPlus, Trash2, Edit, DollarSign, FileWarning, Save, ChevronDown, ChevronRight, Zap, ClipboardList, Bell, ArrowLeft, GripVertical } from 'lucide-react';
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

// === 送測服務 CRM State ===
  const [loginTab, setLoginTab] = useState('internal'); // 'internal' | 'external'
  const [externalForm, setExternalForm] = useState({ 
    name: '', email: '', phone: '', unit: '', note: '', 
    samples: [{ solvent: '', code: '', service_item: '' }] 
  });

  const handleSampleChange = (index, field, value) => {
    const newSamples = [...externalForm.samples];
    newSamples[index][field] = value;
    setExternalForm({ ...externalForm, samples: newSamples });
  };

  const addSample = () => {
    // 取得目前最後一個樣品的資料
    const lastSample = externalForm.samples[externalForm.samples.length - 1];
    setExternalForm({ 
      ...externalForm, 
      samples: [
        ...externalForm.samples, 
        // 幫忙填入上一個的 Solvent 和 服務項目，但把「編碼」清空讓使用者重填
        { solvent: lastSample?.solvent || '', code: '', service_item: lastSample?.service_item || '' }
      ] 
    });
  };

  // === 新增：給編輯服務項目 Modal 用的預設金額 State ===
  const [newServiceItemPrice, setNewServiceItemPrice] = useState(100);

  const removeSample = (index) => {
    const newSamples = externalForm.samples.filter((_, i) => i !== index);
    setExternalForm({ ...externalForm, samples: newSamples });
  };
  const [serviceItems, setServiceItems] = useState([]);
  const [externalRequests, setExternalRequests] = useState([]);
  const [showExternalPanel, setShowExternalPanel] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showServiceItemModal, setShowServiceItemModal] = useState(false);
  const [newServiceItemName, setNewServiceItemName] = useState('');
  // ==========================

  const INSTRUMENTS = ['60', '500'];

// === 服務項目拖曳與編輯邏輯 ===
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const loadServiceItems = async () => {
    // 改為依照 sort_order 排序，如果順序一樣再依 id 排
    const { data } = await supabase.from('service_items').select('*').order('sort_order', { ascending: true }).order('id');
    if (data) setServiceItems(data);
  };

  const handleDragStart = (index) => {
    setDraggedItemIndex(index);
  };

  const handleDragEnter = (index) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newItems = [...serviceItems];
    const draggedItem = newItems[draggedItemIndex];
    newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setDraggedItemIndex(index);
    setServiceItems(newItems); // 畫面即時重新排序
  };

  const handleDragEnd = async () => {
    setDraggedItemIndex(null);
    try {
      // 拖曳放開後，將新的排序順序批次存入 Supabase
      const updates = serviceItems.map((item, index) => ({
        id: item.id,
        name: item.name,
        default_price: item.default_price,
        sort_order: index
      }));
      const { error } = await supabase.from('service_items').upsert(updates);
      if (error) throw error;
    } catch (e) {
      console.error("排序儲存失敗", e);
    }
  };

  const handleUpdateServiceName = async (id, newName) => {
    if (!newName || newName.trim() === '') return;
    await supabase.from('service_items').update({ name: newName.trim() }).eq('id', id);
    loadServiceItems();
  };
  // ==========================

  const loadExternalRequests = async () => {
    const { data } = await supabase.from('external_requests').select('*').order('created_at', { ascending: false });
    if (data) setExternalRequests(data);
  };

  useEffect(() => {
    loadServiceItems();
    loadExternalRequests(); // 系統載入時預先讀取，為了算紅點數量
  }, []);

const handleSaveModal = async () => {
    if (!selectedRequest) return;
    // 計算總金額 (時數 * 費率)
    const total = (selectedRequest.billing_details || []).reduce((sum, item) => sum + (Number(item.hours || 0) * Number(item.rate || 0)), 0);

    try {
      const updates = {
        status: selectedRequest.status,
        admin_note: selectedRequest.admin_note,
        billing_details: selectedRequest.billing_details,
        total_cost: total
      };
      const { error } = await supabase.from('external_requests').update(updates).eq('id', selectedRequest.id);
      if (error) throw error;
      alert('儲存成功！');
      await loadExternalRequests();
      setSelectedRequest(null);
    } catch (error) {
      alert('儲存失敗');
    }
  };

  const handleUpdateServicePrice = async (id, newPrice) => {
    await supabase.from('service_items').update({ default_price: newPrice }).eq('id', id);
    loadServiceItems();
  };

const handleExternalSubmit = async () => {
    // 1. 檢查必填加入 phone 和 unit
    if (!externalForm.name || !externalForm.email || !externalForm.phone || !externalForm.unit) {
      alert('請填寫必填欄位 (姓名、單位、電話、Email)');
      return;
    }
    
    const hasInvalidSample = externalForm.samples.some(s => !s.code || !s.service_item);
    if (hasInvalidSample) {
      alert('請確保「所有樣品」都已填寫編碼與服務項目');
      return;
    }

    try {
      // 2. 存入 Supabase 加入 phone 和 unit
      const { error } = await supabase.from('external_requests').insert([{ 
        name: externalForm.name,
        email: externalForm.email,
        phone: externalForm.phone,
        unit: externalForm.unit,
        note: externalForm.note,
        samples: externalForm.samples
      }]);
      if (error) throw error;
      
      alert('表單送出成功！我們會盡快與您聯絡。');
      
      // 3. 清空表單加入 phone 和 unit
      setExternalForm({ 
        name: '', email: '', phone: '', unit: '', note: '', 
        samples: [{ solvent: '', code: '', service_item: '' }] 
      });
      await loadExternalRequests();

      // 4. 通知 API 加入 phone 和 unit
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: externalForm.name,
            email: externalForm.email,
            phone: externalForm.phone,
            unit: externalForm.unit,
            samples: externalForm.samples,
            note: externalForm.note
          })
        });
      } catch (notifyError) {
        console.error('通知發送異常', notifyError);
      }

    } catch (error) {
      console.error(error);
      alert('送出失敗，請稍後再試');
    }
  };

  const handleDeleteRequest = async (id, name, e) => {
    e.stopPropagation(); // 阻止事件冒泡，避免點擊刪除按鈕時不小心打開詳細資料 Modal
    if (!window.confirm(`確定要刪除「${name}」的委託單嗎？此操作無法復原！`)) {
      return;
    }
    try {
      const { error } = await supabase.from('external_requests').delete().eq('id', id);
      if (error) throw error;
      alert('委託單已刪除！');
      await loadExternalRequests(); // 重新整理列表
      if (selectedRequest?.id === id) setSelectedRequest(null);
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

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
      const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
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
          ext_rule1: '歡迎使用送測服務，請詳細填寫左側表單',
          ext_rule2: '樣品請妥善包裝並標示編號',
          ext_rule3: '若有特殊需求請在備註欄說明',
          ext_rule4: '',
          ext_rule5: '',
          ext_rule6: '',
          ext_rule7: '',
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
    setShowExternalPanel(false);
    setSelectedRequest(null);
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
        rule1: systemSettings.rule1, rule2: systemSettings.rule2, rule3: systemSettings.rule3, 
        rule4: systemSettings.rule4, rule5: systemSettings.rule5, rule6: systemSettings.rule6, rule7: systemSettings.rule7,
        ext_rule1: systemSettings.ext_rule1, ext_rule2: systemSettings.ext_rule2, ext_rule3: systemSettings.ext_rule3,
        ext_rule4: systemSettings.ext_rule4, ext_rule5: systemSettings.ext_rule5, ext_rule6: systemSettings.ext_rule6, ext_rule7: systemSettings.ext_rule7,
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
            
            {/* ====== 左半邊：登入與送測表單區塊 ====== */}
            <div className="md:w-1/2 p-6 md:p-8 flex flex-col h-full relative">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-8 h-8 text-indigo-600" />
                <h1 className="text-3xl font-bold text-gray-800">NDHU_NMR</h1>
              </div>

              {/* 真實標籤頁 (Folder Tabs) 設計 */}
              <div className="flex border-b border-gray-300 mb-5">
                <button 
                  onClick={() => setLoginTab('internal')}
                  className={`flex-1 py-2.5 px-4 text-center text-sm md:text-base transition-all duration-200 rounded-t-lg border-t border-l border-r ${
                    loginTab === 'internal' 
                      ? 'bg-white text-indigo-600 font-bold border-gray-300 border-b-white -mb-px z-10' 
                      : 'bg-gray-100 text-gray-500 font-medium border-transparent hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  校內登入
                </button>
                <button 
                  onClick={() => setLoginTab('external')}
                  className={`flex-1 py-2.5 px-4 text-center text-sm md:text-base transition-all duration-200 rounded-t-lg border-t border-l border-r ${
                    loginTab === 'external' 
                      ? 'bg-white text-indigo-600 font-bold border-gray-300 border-b-white -mb-px z-10' 
                      : 'bg-gray-100 text-gray-500 font-medium border-transparent hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  送測服務
                </button>
              </div>

              {/* 表單切換內容區 */}
              <div className="flex-1 overflow-y-auto pr-2">
                {loginTab === 'internal' ? (
                  /* --- 狀態 1：校內登入 --- */
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
                      className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm hover:shadow-md"
                    >
                      登入 Login
                    </button>
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
                ) : (
                  /* --- 狀態 2：送測服務表單 --- */
                  <div className="space-y-4 pb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">姓名 *</label><input type="text" value={externalForm.name} onChange={(e) => setExternalForm({...externalForm, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 focus:bg-white transition-colors" placeholder="請輸入姓名" /></div>
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">Email *</label><input type="email" value={externalForm.email} onChange={(e) => setExternalForm({...externalForm, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 focus:bg-white transition-colors" placeholder="聯絡信箱" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">單位/實驗室 *</label><input type="text" value={externalForm.unit} onChange={(e) => setExternalForm({...externalForm, unit: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 focus:bg-white transition-colors" placeholder="例如: 化學系 王大明Lab" /></div>
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">聯絡電話 *</label><input type="text" value={externalForm.phone} onChange={(e) => setExternalForm({...externalForm, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 focus:bg-white transition-colors" placeholder="手機或分機" /></div>
                    </div>

                    {/* === 動態樣品清單區塊 === */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 space-y-3 max-h-[35vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-indigo-800">樣品清單 Samples</label>
                        <button onClick={addSample} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition shadow-sm">+ 新增樣品</button>
                      </div>
                      
                      {externalForm.samples.map((sample, index) => (
                        <div key={index} className="bg-white p-3 border border-indigo-200 rounded-lg relative shadow-sm">
                          <h4 className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">樣品 #{index + 1}</h4>
                          {externalForm.samples.length > 1 && (
                            <button onClick={() => removeSample(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1 bg-red-50 rounded">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">D-Solvent</label><input type="text" value={sample.solvent} onChange={(e) => handleSampleChange(index, 'solvent', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="例如: CDCl3" /></div>
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">編碼 *</label><input type="text" value={sample.code} onChange={(e) => handleSampleChange(index, 'code', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-sm" placeholder="樣品編號" /></div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">服務項目 *</label>
                            <select value={sample.service_item} onChange={(e) => handleSampleChange(index, 'service_item', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-sm">
                              <option value="">請選擇服務項目</option>
                              {serviceItems.map(item => (<option key={item.id} value={item.name}>{item.name}</option>))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* === 備註框 === */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">備註 (可拖曳右下角放大)</label>
                      <textarea 
                        value={externalForm.note} 
                        onChange={(e) => setExternalForm({...externalForm, note: e.target.value})} 
                        rows={4} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 focus:bg-white transition-colors" 
                        placeholder={"其他需要特別說明的需求...\n※ 若需調整實驗參數或附上參考文獻，請將相關檔案寄至：ndhu.nmr@gmail.com"} 
                      />
                    </div>
                    <button onClick={handleExternalSubmit} className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium mt-2 shadow-sm hover:shadow-md">送出申請 Submit</button>
                  </div>
                )}
              </div>
            </div>

            {/* ====== 右半邊：動態切換規則與背景色 ====== */}
            <div className={`md:w-1/2 text-white p-8 flex flex-col max-h-screen transition-colors duration-500 ${loginTab === 'internal' ? 'bg-indigo-600' : 'bg-teal-600'}`}>
              <h2 className="text-2xl font-bold mb-6 flex-shrink-0">
                {loginTab === 'internal' ? '使用規則 Rules' : '送測須知 Instructions'}
              </h2>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                {systemSettings ? (
                  [1, 2, 3, 4, 5, 6, 7].map(num => {
                    const ruleText = loginTab === 'internal' 
                      ? systemSettings[`rule${num}`] 
                      : systemSettings[`ext_rule${num}`];
                      
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
            
            {/* 左側編輯區 (加入捲軸與雙區塊) */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-2">編輯介面文字</h2>
              <p className="text-sm text-gray-600 mb-4">修改登入頁面與送測服務顯示的文字</p>
              {systemSettings && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
                  {/* 校內登入規則 */}
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="text-lg font-bold border-b pb-2 mb-4 text-indigo-700">校內使用規則</h3>
                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                      <div key={`rule-${num}`} className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">規則 {num}</label>
                        <textarea value={systemSettings[`rule${num}`] || ''} onChange={(e) => setSystemSettings({ ...systemSettings, [`rule${num}`]: e.target.value })} rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"/>
                      </div>
                    ))}
                  </div>

                  {/* 送測服務須知 */}
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="text-lg font-bold border-b pb-2 mb-4 text-teal-700">校外送測須知</h3>
                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                      <div key={`ext-${num}`} className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">須知 {num}</label>
                        <textarea value={systemSettings[`ext_rule${num}`] || ''} onChange={(e) => setSystemSettings({ ...systemSettings, [`ext_rule${num}`]: e.target.value })} rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"/>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveSettings} className="w-full mt-4 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">儲存設定</button>
                </div>
              )}
            </div>

            {/* 右側即時預覽區 */}
            <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
              <div className="bg-indigo-600 text-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-bold mb-4 border-b border-indigo-400 pb-2">預覽：校內使用規則</h3>
                <div className="space-y-3 text-sm">
                  {systemSettings && [1, 2, 3, 4, 5, 6, 7].map(num => (
                    systemSettings[`rule${num}`] && (
                      <div key={`prev-rule-${num}`} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /><p className="whitespace-pre-wrap">{systemSettings[`rule${num}`]}</p></div>
                    )
                  ))}
                </div>
              </div>
              
              <div className="bg-teal-600 text-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-bold mb-4 border-b border-teal-400 pb-2">預覽：校外送測須知</h3>
                <div className="space-y-3 text-sm">
                  {systemSettings && [1, 2, 3, 4, 5, 6, 7].map(num => (
                    systemSettings[`ext_rule${num}`] && (
                      <div key={`prev-ext-${num}`} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /><p className="whitespace-pre-wrap">{systemSettings[`ext_rule${num}`]}</p></div>
                    )
                  ))}
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

// === 校外委託管理面板 ===
  if (showExternalPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">校外委託管理 (CRM)</h1>
            <div className="flex gap-3">
              <button onClick={() => setShowServiceItemModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"><Settings className="w-4 h-4" />編輯服務項目</button>
              <button onClick={() => setShowExternalPanel(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"><ArrowLeft className="w-4 h-4" />返回</button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {externalRequests.map(req => {
              const sampleCount = req.samples?.length || 0;
              const firstSample = req.samples?.[0] || {};
              return (
                <div 
                  key={req.id} 
                  onClick={() => {
                    // === 動態產生計費項目邏輯 ===
                    let billing = req.billing_details;
                    // 如果這張單子還沒有計費明細，就根據樣品種類自動產生
                    if (!billing || billing.length === 0) {
                      // 抓出所有不重複的服務項目 (例如 [1H NMR, 13C NMR])
                      const uniqueServices = [...new Set((req.samples || []).map(s => s.service_item))].filter(Boolean);
                      billing = uniqueServices.map(serviceName => {
                        const serviceObj = serviceItems.find(item => item.name === serviceName);
                        return {
                          service_item: serviceName,
                          hours: '', // 預設空白，可填小數點
                          rate: serviceObj ? serviceObj.default_price : 100 // 帶入系統設定的預設金額
                        };
                      });
                    }
                    setSelectedRequest({ ...req, billing_details: billing });
                  }} 
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col h-full relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === '未處理' ? 'bg-red-400' : req.status === '已完成' ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                  
                  <div className="flex justify-between items-start mb-3 pl-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${req.status === '未處理' ? 'bg-red-100 text-red-700' : req.status === '已聯絡' ? 'bg-yellow-100 text-yellow-700' : req.status === '已完成' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{req.status}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString()}</span>
                      <button onClick={(e) => handleDeleteRequest(req.id, req.name, e)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors" title="刪除此委託單"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1 pl-2">{req.name}</h3>
                  <div className="text-sm text-gray-500 mb-4 flex-1 pl-2">
                    <p className="font-semibold text-indigo-600 mb-1">共 {sampleCount} 件樣品</p>
                    {sampleCount > 0 && (
                      <p className="text-xs truncate text-gray-400">代表編碼: {firstSample.code}</p>
                    )}
                  </div>
                  <div className="border-t pt-3 mt-auto flex justify-between text-sm pl-2">
                    <span className="text-gray-500">總金額:</span>
                    <span className="font-bold text-indigo-600">${req.total_cost || 0}</span>
                  </div>
                </div>
              );
            })}
            {externalRequests.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">目前尚無委託單</div>}
          </div>
        </div>

        {/* 委託單詳細內容 Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            {/* 改用 flex-col 讓內部可以切分頂部、中間滾動區、底部固定區 */}
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
              
              {/* === 頂部標題區 (固定不動，移除 X 按鈕) === */}
              <div className="p-6 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">委託單處理作業</h2>
              </div>

              {/* === 中間內容區 (自動產生捲軸) === */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* 左側：客戶填寫內容 */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h3 className="font-bold text-gray-700 border-b pb-2 mb-3">客戶基本資料</h3>
                      <p className="text-sm mb-1"><span className="text-gray-500">姓名:</span> {selectedRequest.name}</p>
                      <p className="text-sm mb-1"><span className="text-gray-500">單位:</span> {selectedRequest.unit}</p>
                      <p className="text-sm mb-1"><span className="text-gray-500">電話:</span> {selectedRequest.phone}</p>
                      <p className="text-sm mb-1"><span className="text-gray-500">Email:</span> {selectedRequest.email}</p>
                      <div className="mt-3 pt-3 border-t">
                        <span className="text-gray-500 text-sm block mb-1">備註:</span>
                        {/* 加上 break-words 防止長字串撐破，加上 max-h 防止內容過長佔據太多空間 */}
                        <p className="text-sm whitespace-pre-wrap break-words bg-white p-2 rounded border max-h-48 overflow-y-auto shadow-inner">
                          {selectedRequest.note || '無'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                      <h3 className="font-bold text-indigo-800 border-b border-indigo-200 pb-2 mb-3">
                        樣品清單 (共 {selectedRequest.samples?.length || 0} 件)
                      </h3>
                      <div className="space-y-2 max-h-[28vh] overflow-y-auto pr-2">
                        {selectedRequest.samples?.map((s, idx) => (
                          <div key={idx} className="bg-white p-3 rounded shadow-sm border border-gray-100 text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">#{idx + 1}</span>
                              <span className="font-semibold text-gray-800">{s.code}</span>
                            </div>
                            <div className="flex flex-col text-xs text-gray-600 space-y-1 mt-2">
                              <p>Solvent: <span className="text-gray-800">{s.solvent || '未填'}</span></p>
                              <p>服務: <span className="text-indigo-700 font-medium">{s.service_item}</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 右側：狀態追蹤與計費 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">狀態追蹤</label>
                      <select 
                        value={selectedRequest.status} 
                        onChange={(e) => setSelectedRequest({ ...selectedRequest, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="未處理">未處理</option>
                        <option value="已聯絡">已聯絡</option>
                        <option value="處理中">處理中</option>
                        <option value="已完成">已完成</option>
                        <option value="已取消">已取消</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">管理員備註 (給Operator用)</label>
                      <textarea 
                        value={selectedRequest.admin_note || ''} 
                        onChange={(e) => setSelectedRequest({ ...selectedRequest, admin_note: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="紀錄處理進度或測量結果..."
                      />
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h3 className="font-bold text-gray-700 mb-3 border-b pb-2 flex justify-between">
                        費用計算 
                        <span className="text-xs text-gray-400 font-normal mt-1">依服務種類分類</span>
                      </h3>
                      <div className="space-y-3 mb-4 max-h-[20vh] overflow-y-auto pr-2">
                        {(selectedRequest.billing_details || []).map((bill, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border shadow-sm">
                            <div className="col-span-5 text-sm font-bold text-indigo-700 truncate" title={bill.service_item}>
                              {bill.service_item}
                            </div>
                            <div className="col-span-3">
                              <input 
                                type="number" 
                                step="0.1" 
                                placeholder="時數"
                                value={bill.hours} 
                                onChange={(e) => {
                                  const newBilling = [...selectedRequest.billing_details];
                                  newBilling[index].hours = e.target.value;
                                  setSelectedRequest({...selectedRequest, billing_details: newBilling});
                                }}
                                className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="col-span-1 text-center text-gray-400 text-xs">x</div>
                            <div className="col-span-3">
                              <input 
                                type="number" 
                                placeholder="$ 費率"
                                value={bill.rate} 
                                onChange={(e) => {
                                  const newBilling = [...selectedRequest.billing_details];
                                  newBilling[index].rate = e.target.value;
                                  setSelectedRequest({...selectedRequest, billing_details: newBilling});
                                }}
                                className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        ))}
                        {(!selectedRequest.billing_details || selectedRequest.billing_details.length === 0) && (
                          <p className="text-sm text-gray-500 text-center py-2">無計算項目</p>
                        )}
                      </div>
                      <div className="bg-indigo-600 p-3 rounded-lg flex justify-between items-center text-white shadow-inner">
                        <span className="font-bold opacity-90">總花費金額</span>
                        <span className="font-bold text-2xl">
                          ${(selectedRequest.billing_details || []).reduce((sum, item) => sum + (Number(item.hours || 0) * Number(item.rate || 0)), 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* === 底部按鈕區 (永遠固定在最下方) === */}
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex gap-3 rounded-b-xl flex-shrink-0">
                <button onClick={() => setSelectedRequest(null)} className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium">取消 (不儲存返回)</button>
                <button onClick={handleSaveModal} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md">確認儲存變更</button>
              </div>

            </div>
          </div>
        )}

        {/* 編輯服務項目 Modal */}
        {showServiceItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-xl font-bold text-gray-800">編輯服務項目與預設金額</h2>
                <button onClick={() => setShowServiceItemModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              
              <ul className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                {serviceItems.map((item, index) => (
                  <li 
                    key={item.id} 
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border gap-2 cursor-move ${draggedItemIndex === index ? 'opacity-50 border-indigo-300 border-dashed' : 'hover:bg-gray-100 transition-colors'}`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-grab" title="按住拖曳排序" />
                    
                    <input 
                      type="text"
                      defaultValue={item.name}
                      onBlur={(e) => handleUpdateServiceName(item.id, e.target.value)}
                      className="text-sm font-medium flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:bg-white outline-none px-1 py-0.5 transition-colors"
                      title="點擊修改名稱，移開滑鼠自動儲存"
                    />
                    
                    <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 flex-shrink-0">
                      <span className="text-xs text-gray-500">$</span>
                      <input 
                        type="number" 
                        defaultValue={item.default_price || 100}
                        onBlur={(e) => handleUpdateServicePrice(item.id, Number(e.target.value))}
                        className="w-14 text-sm outline-none text-right font-semibold text-indigo-700"
                        title="點擊修改金額，移開滑鼠自動儲存"
                      />
                    </div>
                    
                    <button 
                      onClick={async () => {
                        await supabase.from('service_items').delete().eq('id', item.id);
                        loadServiceItems();
                      }}
                      className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
                      title="刪除項目"
                    ><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
              
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-800 mb-2">新增服務項目</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newServiceItemName} 
                    onChange={(e) => setNewServiceItemName(e.target.value)} 
                    placeholder="項目名稱..." 
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-1 bg-white border rounded-lg px-2">
                    <span className="text-sm text-gray-500">$</span>
                    <input 
                      type="number" 
                      value={newServiceItemPrice} 
                      onChange={(e) => setNewServiceItemPrice(Number(e.target.value))} 
                      className="w-16 py-2 text-sm outline-none"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (!newServiceItemName) return;
                      await supabase.from('service_items').insert([{ 
                        name: newServiceItemName, 
                        default_price: newServiceItemPrice,
                        sort_order: serviceItems.length // 新增時自動排在最後面
                      }]);
                      setNewServiceItemName('');
                      setNewServiceItemPrice(100);
                      loadServiceItems();
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm flex-shrink-0"
                  >新增</button>
                </div>
              </div>
            </div>
          </div>
        )}
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
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className={`border rounded-lg p-4 ${!user.active ? 'bg-gray-50 opacity-75' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-lg">{user.display_name}</p>
                        {user.active === false && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">已停用</span>}
                        {user.active !== false && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">已啟用</span>}
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
                  <button onClick={() => setShowExternalPanel(true)} className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition text-sm relative">
                    <ClipboardList className="w-4 h-4" />
                    校外委託管理
                    {externalRequests.filter(r => r.status === '未處理').length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </button>
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