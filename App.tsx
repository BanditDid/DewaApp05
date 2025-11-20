import React, { useState, useEffect, useMemo } from 'react';
import { Button, Modal } from './components/UI';
import { EntryForm } from './components/EntryForm';
import { EntryCard, EntryListItem, EntryDetail } from './components/EntryViews';
// หมายเหตุ: เปลี่ยนจาก MockService เป็น GoogleService
// import { MockService } from './services/mockService'; 
import { GoogleService } from './services/googleService';
import { User, BabyProfile, JournalEntry, ViewMode } from './types';
import { formatAge, calculateAge } from './utils';

const App: React.FC = () => {
  // สถานะผู้ใช้และโปรไฟล์
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BabyProfile | null>(null);
  
  // สถานะข้อมูล
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleReady, setIsGoogleReady] = useState(false); // สถานะว่า Library โหลดเสร็จหรือยัง
  const [initError, setInitError] = useState<string | null>(null); // เก็บข้อความ Error

  // สถานะ UI
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.List);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null); 
  
  // สถานะตัวกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);
  const [selectedAgeFilter, setSelectedAgeFilter] = useState<number | null>(null);

  // 1. เริ่มต้น Google Client
  useEffect(() => {
    const initGoogle = async () => {
      try {
        await GoogleService.initClient();
        setIsGoogleReady(true);
        setIsLoading(false);
      } catch (e: any) {
        console.error("Failed to init Google Client", e);
        setInitError(e.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุในการเชื่อมต่อกับ Google");
        setIsLoading(false);
      }
    };
    initGoogle();
  }, []);

  // คำนวณอายุปัจจุบันของลูก
  const currentAge = useMemo(() => {
    if (!profile?.birthDate) return null;
    return calculateAge(profile.birthDate, new Date().toISOString());
  }, [profile]);

  // 2. จัดการ Login และดึงข้อมูล
  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const u = await GoogleService.login();
      setUser(u);
      
      // ตรวจสอบและสร้าง Sheet/Folder ถ้ายังไม่มี
      await GoogleService.setupStorage();
      
      const p = await GoogleService.getProfile();
      setProfile(p);
      
      // ถ้ามี Profile แล้ว ให้ดึงข้อมูล Entries ด้วย
      if (p) {
        const e = await GoogleService.getEntries();
        setEntries(e);
      }
    } catch (error) {
      console.error("Login Failed", error);
      alert("การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const newProfile: BabyProfile = {
      name: formData.get('name') as string,
      birthDate: formData.get('birthDate') as string,
    };
    await GoogleService.saveProfile(newProfile);
    setProfile(newProfile);
    // โหลดข้อมูลใหม่ (แม้ว่าจะยังไม่มีก็ตาม เพื่อความชัวร์)
    const eList = await GoogleService.getEntries();
    setEntries(eList);
    setIsLoading(false);
  };

  // 3. จัดการบันทึกข้อมูล (Entry Saved)
  // หมายเหตุ: EntryForm ต้องถูกปรับให้ส่ง File Object กลับมาด้วย (ในโค้ดเดิมมัน handle ภายใน แต่เพื่อให้ GoogleService upload ได้ เราต้องปรับการไหลของข้อมูลเล็กน้อย หรือให้ EntryForm เรียก Service เอง)
  // ในที่นี้เพื่อความง่าย จะปรับ EntryForm ให้เรียก GoogleService.saveEntry แทน MockService
  const refreshEntries = async () => {
    const e = await GoogleService.getEntries();
    setEntries(e);
    setIsEditModalOpen(false);
    setEditingEntry(null);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
    setViewingEntry(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าจะลบรายการนี้? (รูปภาพใน Drive จะยังคงอยู่)')) {
      setIsLoading(true);
      await GoogleService.deleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      setViewingEntry(null);
      setIsLoading(false);
    }
  };

  // ตัวกรอง (เหมือนเดิม)
  const uniqueTags = useMemo(() => Array.from(new Set(entries.flatMap(e => e.tags))), [entries]);
  const uniqueYears = useMemo(() => Array.from(new Set(entries.map(e => e.ageAtTime.years))).sort((a: number, b: number) => a - b), [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = e.notes.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = selectedFilterTag ? e.tags.includes(selectedFilterTag) : true;
      const matchesAge = selectedAgeFilter !== null ? e.ageAtTime.years === selectedAgeFilter : true;
      return matchesSearch && matchesTag && matchesAge;
    });
  }, [entries, searchTerm, selectedFilterTag, selectedAgeFilter]);

  // --- ส่วนแสดงผล (RENDER) ---

  // 1. แสดง Error ถ้า Init ไม่สำเร็จ
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">การตั้งค่าไม่สมบูรณ์</h2>
          <p className="text-gray-600 mb-6">{initError}</p>
          <div className="bg-gray-100 p-4 rounded-lg text-left text-sm text-gray-700 mb-6 overflow-auto max-h-40">
            <p className="font-bold mb-1">วิธีแก้ไข:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>เปิดไฟล์ <code>services/googleService.ts</code></li>
              <li>ใส่ <strong>CLIENT_ID</strong> และ <strong>API_KEY</strong> ที่ได้จาก Google Cloud Console</li>
              <li>ตรวจสอบว่า URL ของเว็บ (เช่น localhost) ถูกเพิ่มใน "Authorized JavaScript origins" บน Google Console แล้ว</li>
            </ul>
          </div>
          <button onClick={() => window.location.reload()} className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors">
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  // 2. แสดง Loading
  if (!isGoogleReady) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans text-gray-500 gap-4 bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
        <p>กำลังเชื่อมต่อกับ Google Services...</p>
      </div>
     );
  }

  // 3. แสดงหน้า Login (ถ้ายังไม่ Login)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BabyPhotoJournal</h1>
          <p className="text-gray-500 mb-8">เก็บทุกความทรงจำและพัฒนาการของลูกน้อยอย่างปลอดภัยด้วย Google Drive (Full Version)</p>
          
          <button 
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all shadow-sm disabled:opacity-50"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
            {isLoading ? 'กำลังดำเนินการ...' : 'เข้าสู่ระบบด้วย Google'}
          </button>
        </div>
      </div>
    );
  }

  // 4. แสดงหน้า Setup Profile (ถ้า Login แล้วแต่ไม่มีข้อมูลเด็ก)
  if (!profile) {
    return (
      <div className="min-h-screen bg-primary-50 flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleSaveProfile} className="bg-white max-w-md w-full rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">ยินดีต้อนรับ! ข้อมูลของเจ้าตัวเล็ก</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อลูก</label>
              <input name="name" required placeholder="เช่น น้องมีนา" className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันเกิด</label>
              <input name="birthDate" type="date" required className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <Button type="submit" isLoading={isLoading} className="w-full justify-center">เริ่มบันทึกความทรงจำ</Button>
          </div>
        </form>
      </div>
    );
  }

  // 5. แสดงหน้าหลัก (Main App)
  return (
    <div className="min-h-screen bg-primary-50 pb-20 md:pb-10 font-sans">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-auto py-3 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/30">B</div>
            <div className="flex flex-col">
              <h1 className="font-bold text-gray-900 text-lg leading-tight">BabyPhotoJournal</h1>
              {currentAge && (
                <span className="text-xs md:text-sm text-primary-600 font-medium">
                  อายุปัจจุบัน: {formatAge(currentAge)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900">{user.name}</span>
                <span className="text-xs text-gray-500">บันทึกของ {profile.name}</span>
             </div>
             <img src={user.avatarUrl} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="User" />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="relative w-full md:w-72">
            <input 
              type="text" 
              placeholder="ค้นหาความทรงจำ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="bg-white rounded-lg p-1 border border-gray-200 flex shadow-sm">
                <button 
                  onClick={() => setViewMode(ViewMode.List)}
                  className={`p-2 rounded-md transition-all ${viewMode === ViewMode.List ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  title="มุมมองรายการ"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </button>
                <button 
                   onClick={() => setViewMode(ViewMode.Grid)}
                   className={`p-2 rounded-md transition-all ${viewMode === ViewMode.Grid ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                   title="มุมมองตาราง"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </button>
             </div>
             <Button onClick={() => { setEditingEntry(null); setIsEditModalOpen(true); }} className="flex-1 md:flex-none whitespace-nowrap shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all">
               + บันทึกใหม่
             </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
           <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-2">ตัวกรอง:</span>
           {(selectedFilterTag || selectedAgeFilter !== null) && (
             <button onClick={() => { setSelectedFilterTag(null); setSelectedAgeFilter(null); }} className="text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-full transition-colors">
               ล้างค่า
             </button>
           )}

           {uniqueYears.map(year => (
              <button 
                key={year} 
                onClick={() => setSelectedAgeFilter(selectedAgeFilter === year ? null : year)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${selectedAgeFilter === year ? 'bg-gray-800 text-white border-gray-800 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'}`}
              >
                {year} ขวบ
              </button>
           ))}

           {uniqueTags.map(tag => (
              <button 
                key={tag} 
                onClick={() => setSelectedFilterTag(selectedFilterTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${selectedFilterTag === tag ? 'bg-primary-100 text-primary-700 border-primary-200 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'}`}
              >
                #{tag}
              </button>
           ))}
        </div>

        {/* Content */}
        {isLoading ? (
           <div className="text-center py-20 text-gray-400 animate-pulse">กำลังโหลดข้อมูลจาก Google Drive...</div>
        ) : filteredEntries.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 flex flex-col items-center">
             <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
             <p className="text-gray-500 font-medium">ยังไม่มีรายการบันทึก</p>
             <p className="text-gray-400 text-sm mt-1">เริ่มเก็บความทรงจำแรกของคุณได้เลย!</p>
           </div>
        ) : (
          <div className={viewMode === ViewMode.Grid ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
            {filteredEntries.map(entry => (
              viewMode === ViewMode.Grid ? (
                <EntryCard 
                  key={entry.id} 
                  entry={entry} 
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                  onView={setViewingEntry} 
                />
              ) : (
                <EntryListItem 
                  key={entry.id} 
                  entry={entry} 
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                  onView={setViewingEntry} 
                />
              )
            ))}
          </div>
        )}
      </main>

      {/* Edit/Create Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        title={editingEntry ? "แก้ไขความทรงจำ" : "บันทึกความทรงจำใหม่"}
      >
        <EntryForm 
          birthDate={profile.birthDate} 
          initialData={editingEntry}
          onSave={refreshEntries} // โหลดข้อมูลใหม่หลังจากบันทึก
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Detail View Modal */}
      <Modal 
        isOpen={!!viewingEntry} 
        onClose={() => setViewingEntry(null)}
        title="รายละเอียดความทรงจำ"
      >
        {viewingEntry && (
          <div className="relative">
            <EntryDetail entry={viewingEntry} />
            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => handleDelete(viewingEntry.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                ลบรายการ
              </Button>
              <Button onClick={() => handleEdit(viewingEntry)}>
                แก้ไขข้อมูล
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default App;