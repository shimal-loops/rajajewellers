
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layouts/Header';
import Footer from '../components/layouts/Footer';
import ImageUploadCard from '../components/ImageUploadCard';
import Toast, { ToastType } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ImageModal from '../components/ImageModal';
import { ImageData, JewelryItem, JewelryCategory, Manager, ManagerStatus, Fitting } from '../types';

interface AdminDashboardProps {
    jewelryItems: JewelryItem[];
    onAdd: (item: JewelryItem) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onUpdate: (item: JewelryItem) => Promise<boolean>;
}

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ jewelryItems, onAdd, onDelete, onUpdate }) => {
    // Tab state
    const [activeTab, setActiveTab] = useState<'REGISTRY' | 'USERS'>('REGISTRY');

    // Registry / Add Form state
    const [newJewelryName, setNewJewelryName] = useState('');
    const [newJewelryCategory, setNewJewelryCategory] = useState<JewelryCategory>(JewelryCategory.NECKLACE);
    const [newJewelryImage, setNewJewelryImage] = useState<ImageData | null>(null);
    const [newJewelryHeight, setNewJewelryHeight] = useState<string>('0');
    const [newJewelryWidth, setNewJewelryWidth] = useState<string>('0');
    const [heightUnit, setHeightUnit] = useState<'mm' | 'cm'>('mm');
    const [widthUnit, setWidthUnit] = useState<'mm' | 'cm'>('mm');
    const [isAdding, setIsAdding] = useState(false);

    // Registry / Edit state
    const [editingItem, setEditingItem] = useState<JewelryItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState<JewelryCategory>(JewelryCategory.NECKLACE);

    // Registry / Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Users state
    const [managers, setManagers] = useState<Manager[]>([]);
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);


    // UI state
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [imageModal, setImageModal] = useState<{
        isOpen: boolean;
        imageUrl: string;
        imageName: string;
    }>({ isOpen: false, imageUrl: '', imageName: '' });

    // Toast management
    const showToast = (message: string, type: ToastType) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Logout
    const handleLogout = async () => {
        try {
            await fetch('/rajaJewellers/api/logout.php');
            window.location.href = '/rajaJewellers/admin/login';
        } catch (error) {
            window.location.href = '/rajaJewellers/admin/login';
        }
    };

    // User Management logic
    const fetchManagers = async () => {
        setIsLoadingManagers(true);
        try {
            const response = await fetch('/rajaJewellers/api/get_managers.php');
            const data = await response.json();
            setManagers(data);
        } catch (error) {
            showToast('Failed to load managers', 'error');
        } finally {
            setIsLoadingManagers(false);
        }
    };

    const handleUpdateManagerStatus = async (id: string, newStatus: ManagerStatus, action: 'update' | 'delete' = 'update') => {
        try {
            const response = await fetch('/rajaJewellers/api/update_manager_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus, action })
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message, 'success');
                fetchManagers();
            } else {
                showToast(data.error || 'Failed to update manager', 'error');
            }
        } catch (error) {
            showToast('API Error', 'error');
        }
    };


    React.useEffect(() => {
        if (activeTab === 'USERS') {
            fetchManagers();
        }

    }, [activeTab]);

    // Registry logic
    const filteredItems = useMemo(() => {
        return jewelryItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [jewelryItems, searchQuery, filterCategory]);

    const stats = useMemo(() => {
        const categoryCount: Record<string, number> = {};
        jewelryItems.forEach(item => {
            categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
        });
        return {
            total: jewelryItems.length,
            byCategory: categoryCount
        };
    }, [jewelryItems]);

    const handleAddJewelry = async () => {
        if (!newJewelryName || !newJewelryImage) {
            showToast('Please fill in all fields', 'warning');
            return;
        }
        setIsAdding(true);
        try {
            const hMult = heightUnit === 'cm' ? 10 : 1;
            const wMult = widthUnit === 'cm' ? 10 : 1;

            await onAdd({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: newJewelryName,
                category: newJewelryCategory,
                image: newJewelryImage,
                height: (parseFloat(newJewelryHeight) * hMult) || 0,
                width: (parseFloat(newJewelryWidth) * wMult) || 0
            });
            setNewJewelryName('');
            setNewJewelryImage(null);
            setNewJewelryHeight('0');
            setNewJewelryWidth('0');
            showToast('Jewelry item added successfully!', 'success');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to add jewelry item';
            showToast(errorMessage, 'error');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteClick = (item: JewelryItem) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Item',
            message: `Are you sure you want to delete "${item.name}"?`,
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    await onDelete(item.id);
                    showToast('Item deleted successfully', 'success');
                } catch (error) {
                    showToast('Failed to delete item', 'error');
                }
            }
        });
    };

    const handleBulkDeleteClick = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Bulk Delete',
            message: `Delete ${selectedItems.size} items?`,
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                let successCount = 0;
                for (const id of Array.from(selectedItems)) {
                    try {
                        await onDelete(id);
                        successCount++;
                    } catch (e) { }
                }
                setSelectedItems(new Set());
                showToast(`Deleted ${successCount} items`, 'success');
            }
        });
    };

    const handleEditClick = (item: JewelryItem) => {
        setEditingItem(item);
        setEditName(item.name);
        setEditCategory(item.category);
    };

    const handleEditSave = async () => {
        if (!editingItem) return;
        const success = await onUpdate({ ...editingItem, name: editName, category: editCategory });
        if (success) {
            showToast('Item updated', 'success');
            setEditingItem(null);
        } else {
            showToast('Update failed', 'error');
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 min-h-screen flex flex-col bg-slate-50/50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <img src="https://ai.loopsintegrated.co/logo/rajalogo.png" alt="Logo" className="h-10 w-auto" />
                    <div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
                        <div className="flex gap-4 mt-2">
                            {['REGISTRY', 'USERS'].map((tab: any) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400'}`}
                                >
                                    {tab === 'REGISTRY' ? 'Jewelry Registry' : 'User Management'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={handleLogout} className="bg-white border text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all">Logout</button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'REGISTRY' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full min-h-0">
                        {/* Stats & Form */}
                        <div className="md:col-span-4 space-y-4 overflow-y-auto pr-2">
                            <div className="bg-purple-600 text-white p-6 rounded-3xl shadow-lg">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Items</p>
                                <p className="text-3xl font-black">{stats.total}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-black">Add New Asset</h2>
                                    <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg text-[8px] font-black tracking-widest uppercase">AI Precision Mode</span>
                                </div>
                                <input value={newJewelryName} onChange={e => setNewJewelryName(e.target.value)} placeholder="Name" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs text-slate-900 focus:ring-1 focus:ring-purple-500 outline-none transition-all shadow-sm" />
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Category</label>
                                    <select value={newJewelryCategory} onChange={e => setNewJewelryCategory(e.target.value as JewelryCategory)} className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900 focus:ring-1 focus:ring-purple-500 outline-none transition-all shadow-sm appearance-none">
                                        {Object.values(JewelryCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <div className="group/dim">
                                        <div className="flex justify-between items-center mb-1.5 px-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 group-focus-within/dim:text-purple-600 transition-colors">Height</label>
                                            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                                {['mm', 'cm'].map((u) => (
                                                    <button key={u} type="button" onClick={() => setHeightUnit(u as 'mm' | 'cm')} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all ${heightUnit === u ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>{u}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <input type="number" step="0.1" value={newJewelryHeight} onChange={e => setNewJewelryHeight(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900 focus:ring-1 focus:ring-purple-500 outline-none transition-all" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="group/dim">
                                            <div className="flex justify-between items-center mb-1.5 px-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 group-focus-within/dim:text-purple-600 transition-colors">Width</label>
                                                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                                    {['mm', 'cm'].map((u) => (
                                                        <button key={u} type="button" onClick={() => setWidthUnit(u as 'mm' | 'cm')} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all ${widthUnit === u ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>{u}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <input type="number" step="0.1" value={newJewelryWidth} onChange={e => setNewJewelryWidth(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900 focus:ring-1 focus:ring-purple-500 outline-none transition-all" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
                                    <p className="text-[9px] text-amber-700 leading-relaxed font-medium italic">
                                        <span className="font-black uppercase tracking-tighter">Pro Tip:</span> Enter exact physical sizes from the jewelry designer. 
                                        The AI uses these <span className="font-bold underline">millimeters</span> to calculate the perfect anatomical scale on the human body.
                                    </p>
                                </div>
                                <ImageUploadCard label="Photo" image={newJewelryImage} onImageChange={setNewJewelryImage} className="h-60" />
                                <button onClick={handleAddJewelry} disabled={isAdding} className="w-full bg-purple-600 text-white font-black py-3 rounded-xl hover:bg-purple-700 transition-all">
                                    {isAdding ? 'Adding...' : 'Commit Asset'}
                                </button>
                                <Link to="/" className="block text-center text-[10px] font-black uppercase text-slate-400">Exit to Site</Link>
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="md:col-span-8 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden">
                            <div className="p-6 border-b flex justify-between items-center gap-4 bg-slate-50/50">
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="flex-1 border border-slate-200 p-2 rounded-xl text-sm text-slate-900" />
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-slate-200 p-2 rounded-xl text-sm text-slate-900">
                                    <option value="ALL">All Categories</option>
                                    {Object.values(JewelryCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                {selectedItems.size > 0 && (
                                    <button onClick={handleBulkDeleteClick} className="bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black">Delete {selectedItems.size}</button>
                                )}
                            </div>
                            <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto">
                                {filteredItems.map(item => (
                                    <div key={item.id} className="group relative bg-slate-50 border rounded-2xl p-2 hover:border-purple-200 transition-all">
                                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => {
                                            const s = new Set(selectedItems);
                                            s.has(item.id) ? s.delete(item.id) : s.add(item.id);
                                            setSelectedItems(s);
                                        }} className="absolute top-2 left-2 z-10" />
                                        <div className="aspect-square bg-white rounded-xl mb-2 overflow-hidden cursor-pointer" onClick={() => setImageModal({ isOpen: true, imageUrl: item.image.previewUrl.startsWith('http') ? item.image.previewUrl : `/rajaJewellers/${item.image.previewUrl}`, imageName: item.name })}>
                                            <img src={item.image.previewUrl.startsWith('http') ? item.image.previewUrl : `/rajaJewellers/${item.image.previewUrl}`} className="w-full h-full object-contain" alt={item.name} />
                                        </div>
                                        <p className="text-[10px] font-black truncate">{item.name}</p>
                                        <p className="text-[8px] font-black text-purple-600">{item.category}</p>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => handleDeleteClick(item)} className="bg-red-500 text-white p-1 rounded-lg">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'USERS' && (
                    <div className="bg-white rounded-3xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
                        <div className="p-6 border-b bg-slate-50/50">
                            <h2 className="text-xl font-black">User Management</h2>
                            <p className="text-xs text-slate-400">Manage dashboard access</p>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-4">
                            {isLoadingManagers ? <p className="text-center py-10">Loading...</p> : managers.map(m => (
                                <div key={m.id} className="bg-slate-50 border p-6 rounded-2xl flex justify-between items-center">
                                    <div>
                                        <p className="font-black">{m.username}</p>
                                        <p className="text-xs text-slate-500">{m.email}</p>
                                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${m.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.status}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {m.status !== 'APPROVED' && <button onClick={() => handleUpdateManagerStatus(m.id, ManagerStatus.APPROVED)} className="bg-green-600 text-white text-[10px] font-black px-4 py-2 rounded-lg">Approve</button>}
                                        {m.status !== 'REJECTED' && <button onClick={() => handleUpdateManagerStatus(m.id, ManagerStatus.REJECTED)} className="bg-amber-600 text-white text-[10px] font-black px-4 py-2 rounded-lg">Reject</button>}
                                        <button onClick={() => handleUpdateManagerStatus(m.id, ManagerStatus.PENDING, 'delete')} className="bg-red-100 text-red-600 text-[10px] font-black px-4 py-2 rounded-lg">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Footer />

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            />
            <ImageModal
                isOpen={imageModal.isOpen}
                imageUrl={imageModal.imageUrl}
                imageName={imageModal.imageName}
                onClose={() => setImageModal({ ...imageModal, isOpen: false })}
            />
            {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />)}
        </div>
    );
};

export default AdminDashboard;
