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
  const [newLabForm, setNewLabForm] = useState({ name: '', description: '' });
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    display_name: '',
    pi: '',
    instruments: [],
    is_admin: false
  });

  useEffect(() => {
    loadSystemSettings();
    loadLabs();
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
        // 如果沒有設定，使用預設值
        const defaultSettings = {
          rule1: '請提前預約所需時段，系統開放預約未來時段',
          rule2: '不可預約或取消已過去的時間',
          rule3: '預約時間粒度為30分鐘，開放時段為9:00-21:00',
          rule4: '另有21:00-09:00夜間時段可預約',
          rule5: '請準時使用儀器，並保持儀器清潔',
          rule6: '使用前請確認已通過該儀器操作訓練',
          rule7: '如有問題請聯絡管理員'
        };
        setSystemSettings(defaultSettings);
      }
    } catch (error) {
      console.error('載入系統設定失敗:', error);
      // 發生錯誤時也使用預設值
      const defaultSettings = {
        rule1: '請提前預約所需時段，系統開放預約未來時段',
        rule2: '不可預約或取消已過去的時間',
        rule3: '預約時間粒度為30分鐘，開放時段為9:00-21:00',
        rule4: '另有21:00-09:00夜間時段可預約',
        rule5: '請準時使用儀器，並保持儀器清潔',
        rule6: '使用前請確認已通過該儀器操作訓練',
        rule7: '如有問題請聯絡管理員'
      };
      setSystemSettings(defaultSettings);
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
      alert('請輸入帳號和密碼');
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
        alert('帳號或密碼錯誤');
        return;
      }

      if (data.active === false) {
        alert('此帳號已被停用，請聯絡管理員');
        return;
      }

      setCurrentUser(data);
      setIsLoggedIn(true);
      setShowNotification(true);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      alert('登入失敗，請稍後再試');
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
    setBookings([]);
  };

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 21; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    slots.push('21:00-09:00');
    return slots;
  };

  const isTimePassed = (date, timeSlot) => {
    const now = new Date();
    const selectedDateTime = new Date(date);
    
    if (timeSlot === '21:00-09:00') {
      selectedDateTime.setHours(21, 0, 0, 0);
    } else {
      const [hour, minute] = timeSlot.split(':').map(Number);
      selectedDateTime.setHours(hour, minute, 0, 0);
    }
    
    return selectedDateTime < now;
  };

  const handleBooking = async (timeSlot) => {
    if (!selectedInstrument || !selectedDate) {
      alert('請選擇儀器和日期');
      return;
    }

    if (isTimePassed(selectedDate, timeSlot)) {
      alert('不可預約已過去的時間');
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
          alert('此時段已被預約');
        } else {
          throw error;
        }
        return;
      }

      alert('預約成功！');
      await loadBookings();
    } catch (error) {
      console.error('預約失敗:', error);
      alert('預約失敗，請稍後再試');
    }
  };

  const handleCancelBooking = async (bookingId, timeSlot) => {
    if (isTimePassed(selectedDate, timeSlot)) {
      alert('不可取消已過去的預約');
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      alert('已取消預約');
      await loadBookings();
    } catch (error) {
      console.error('取消失敗:', error);
      alert('取消失敗，請稍後再試');
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

      // 只有在密碼有填寫時才更新
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
      // 先刪除該用戶的所有預約
      await supabase
        .from('bookings')
        .delete()
        .eq('username', username);

      // 再刪除用戶
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
        // 更新
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
        // 新增
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

  const exportToCSV = () => {
    if (historyBookings.length === 0) {
      alert('沒有資料可以匯出');
      return;
    }

    // 建立 CSV 標題
    const headers = ['預約時間', '用戶名稱', 'Lab', '儀器 (MHz)', '預約日期', '時段'];
    
    // 建立 CSV 內容
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

    // 加入 BOM 以支援中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 建立下載連結
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
    // 檢查是否有用戶使用此 Lab
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">帳號</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密碼</label>
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
                  登入
                </button>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900 mb-1">測試帳號</p>
                    <p className="text-amber-800">管理員: admin / admin123</p>
                    <p className="text-amber-800">一般用戶: user1 / pass123</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:w-1/2 bg-indigo-600 text-white p-8 flex flex-col max-h-screen">
              <h2 className="text-2xl font-bold mb-6 flex-shrink-0">使用規則</h2>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                {systemSettings ? (
                  [1, 2, 3, 4, 5, 6, 7].map(num => {
                    const ruleText = systemSettings[`rule${num}`];
                    // 只顯示有內容的規則
                    if (!ruleText || ruleText.trim() === '') return null;
                    
                    return (
                      <div key={num} className="flex items-start gap-3">
                        <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                        <p className="whitespace-pre-wrap">{ruleText}</p>
                      </div>
                    );
                  })
                ) : (
                  // 載入中或載入失敗時顯示預設規則
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
                      <p>預約時間粒度為30分鐘，開放時段為9:00-21:00</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-1 flex-shrink-0" />
                      <p>另有21:00-09:00夜間時段可預約</p>
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
            <p className="text-gray-600 mb-6">歡迎使用NMR預約系統</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-700 mb-2"><strong>注意事項：</strong></p>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>請勿預約已過去的時段</li>
                <li>預約後請準時使用</li>
                <li>使用完畢請保持儀器清潔</li>
              </ul>
            </div>
            
            <button
              onClick={() => setShowNotification(false)}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              開始使用
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                placeholder="例如：003"
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

  // 編輯 Lab 彈窗
  if (showEditLabModal && editingLab) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">編輯 Lab</h2>
            <button onClick={() => { setShowEditLabModal(false); setEditingLab(null); }} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label>
              <input
                type="text"
                value={editingLab.name}
                onChange={(e) => setEditingLab({...editingLab, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">描述（選填）</label>
              <input
                type="text"
                value={editingLab.description || ''}
                onChange={(e) => setEditingLab({...editingLab, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setShowEditLabModal(false); setEditingLab(null); }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              取消
            </button>
            <button
              onClick={handleEditLab}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              儲存
            </button>
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

  // 新增用戶彈窗
  if (showAddUserModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">新增用戶</h2>
            <button onClick={() => setShowAddUserModal(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">帳號 *</label>
              <input
                type="text"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：chen123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">密碼 *</label>
              <input
                type="text"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="設定密碼"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">顯示名稱 *</label>
              <input
                type="text"
                value={newUserForm.display_name}
                onChange={(e) => setNewUserForm({...newUserForm, display_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：陳小明"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lab 名稱 *</label>
              <select
                value={newUserForm.pi}
                onChange={(e) => setNewUserForm({...newUserForm, pi: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">請選擇 Lab</option>
                {labs.map(lab => (
                  <option key={lab.id} value={lab.name}>{lab.name} {lab.description && `(${lab.description})`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">儀器權限</label>
              <div className="flex gap-3">
                <button
                  onClick={() => toggleNewUserInstrument('50')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    newUserForm.instruments.includes('50')
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  50 MHz {newUserForm.instruments.includes('50') ? '✓' : ''}
                </button>
                <button
                  onClick={() => toggleNewUserInstrument('500')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    newUserForm.instruments.includes('500')
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  500 MHz {newUserForm.instruments.includes('500') ? '✓' : ''}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_admin"
                checked={newUserForm.is_admin}
                onChange={(e) => setNewUserForm({...newUserForm, is_admin: e.target.checked})}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="is_admin" className="text-sm text-gray-700">設為管理員</label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowAddUserModal(false)}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              取消
            </button>
            <button
              onClick={handleAddUser}
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
            {/* 左側：編輯區 */}
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

            {/* 右側：即時預覽（固定位置） */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-2">即時預覽</h2>
                <p className="text-sm text-gray-600 mb-4">這是用戶在登入頁面看到的樣子</p>
                
                {/* 預覽框 - 可滾動 */}
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
    if (!historyBookings.length && !loading) {
      loadHistoryBookings();
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">歷史預約記錄</h1>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
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
                暫無預約記錄
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
                    <button
                      onClick={() => toggleUserInstrument(user.id, '50')}
                      disabled={user.active === false}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        user.active === false
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : user.instruments?.includes('50')
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      50 MHz {user.instruments?.includes('50') ? '✓' : ''}
                    </button>
                    <button
                      onClick={() => toggleUserInstrument(user.id, '500')}
                      disabled={user.active === false}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        user.active === false
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : user.instruments?.includes('500')
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      500 MHz {user.instruments?.includes('500') ? '✓' : ''}
                    </button>
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
                    onClick={() => setShowLabManagementPanel(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Lab 管理
                  </button>
                  <button
                    onClick={() => setShowHistoryPanel(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    歷史記錄
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
                登出
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇儀器</label>
              <select
                value={selectedInstrument}
                onChange={(e) => setSelectedInstrument(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">請選擇儀器</option>
                {currentUser?.instruments?.length === 0 ? (
                  <option disabled>您尚無儀器使用權限</option>
                ) : (
                  currentUser?.instruments?.map(instrument => (
                    <option key={instrument} value={instrument}>{instrument} MHz NMR</option>
                  ))
                )}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇日期</label>
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
                        <span className="font-medium text-sm">{slot}</span>
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
                              取消
                            </button>
                          )}
                        </div>
                      ) : (
                        !isPast && <p className="text-xs text-gray-500">可預約</p>
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
          </div>
        )}
      </div>
    </div>
  );
}