import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, LogOut, Settings, X, Check, AlertCircle, UserCheck, UserX, UserPlus, Trash2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function NMRBookingSystem() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
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

  // 儀器列表 - 統一管理所有儀器型號
  const INSTRUMENTS = ['60', '500'];

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
  }, [isLoggedIn, selectedInstrument, selectedDate]);

  useEffect(() => {
    if (isLoggedIn && !selectedDate) {
      setSelectedDate(getTodayString());
    }
  }, [isLoggedIn]);

  const loadUsers = async () => {
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
  };

  const loadSystemSettings = async () => {
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
        // 預設時段設定
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

  const loadHistoryBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('booked_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setHistoryBookings(data || []);
    } catch (error) {
      console.error('載入歷史記錄失敗:', error);
    }
  };

  const loadLabs = async () => {
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

  const loadBookings = async () => {
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

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const generateTimeSlots = () => {
    if (!timeSlotSettings) return [];
    
    const slots = [];
    const dayStart = parseInt(timeSlotSettings.day_start.split(':')[0]);
    const dayEnd = parseInt(timeSlotSettings.day_end.split(':')[0]);
    const nightStart = parseInt(timeSlotSettings.night_start.split(':')[0]);
    const dayInterval = timeSlotSettings.day_interval;
    const nightInterval = timeSlotSettings.night_interval;
    
    // 日間時段 (09:00-18:00, 15分鐘)
    for (let hour = dayStart; hour < dayEnd; hour++) {
      for (let min = 0; min < 60; min += dayInterval) {
        const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endMin = min + dayInterval;
        const endHour = endMin >= 60 ? hour + 1 : hour;
        const finalMin = endMin >= 60 ? endMin - 60 : endMin;
        const endTime = `${endHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`;
        slots.push(`${startTime}-${endTime}`);
      }
    }
    
    // 夜間時段 (18:00-隔天09:00, 30分鐘)
    for (let hour = nightStart; hour < 24; hour++) {
      for (let min = 0; min < 60; min += nightInterval) {
        const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endMin = min + nightInterval;
        const endHour = endMin >= 60 ? hour + 1 : hour;
        const finalMin = endMin >= 60 ? endMin - 60 : endMin;
        const endTime = endHour >= 24 ? `00:${finalMin.toString().padStart(2, '0')}` : `${endHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`;
        slots.push(`${startTime}-${endTime}`);
      }
    }
    
    for (let hour = 0; hour < dayStart; hour++) {
      for (let min = 0; min < 60; min += nightInterval) {
        const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endMin = min + nightInterval;
        const endHour = endMin >= 60 ? hour + 1 : hour;
        const finalMin = endMin >= 60 ? endMin - 60 : endMin;
        const endTime = `${endHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`;
        slots.push(`${startTime}-${endTime}`);
      }
    }
    
    return slots;
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
    if (username === 'admin') {
      alert('不能刪除管理員帳號');
      return;
    }

    if (!confirm(`確定要刪除用戶 "${username}" 嗎？此操作無法復原！`)) {
      return;
    }

    try {
      await supabase
        .from('bookings')
        .delete()
        .eq('username', username);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      alert('用戶已刪除');
      await loadUsers();
    } catch (error) {
      console.error('刪除用戶失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  const handleSaveSettings = async () => {
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
    link.setAttribute('download', `預約記錄_${new Date().toISOString().split('T')[0]}.csv`);
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
    const usersWithLab = users.filter(u => u.pi === labName);
    if (usersWithLab.length > 0) {
      alert(`無法刪除：有 ${usersWithLab.length} 個用戶使用此 Lab`);
      return;
    }

    if (!confirm(`確定要刪除 Lab "${labName}" 嗎？`)) {
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

  // 時段設定面板
  if (showTimeSlotPanel && currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">時段設定</h1>
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
          <div className="bg-white rounded-lg shadow-sm p-6">
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
        </div>
      </div>
    );
  }

  // 其餘介面代碼繼續...
  // 由於字數限制，我會在下一個回應繼續
  
  // 主預約界面
  const timeSlots = generateTimeSlots();

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
                    onClick={() => setShowHistoryPanel(true)}
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