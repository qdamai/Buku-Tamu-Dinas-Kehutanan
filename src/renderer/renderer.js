document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing application...');
    
    // Pastikan electronAPI tersedia
    if (!window.electronAPI) {
        console.error('electronAPI tidak tersedia!');
        return;
    }

    console.log('Available APIs:', Object.keys(window.electronAPI));

    // DOM Elements
    const tamuForm = document.getElementById('tamuForm');
    const resetBtn = document.getElementById('resetBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const searchInput = document.getElementById('searchInput');
    const filterTanggalMulai = document.getElementById('filterTanggalMulai');
    const filterTanggalSelesai = document.getElementById('filterTanggalSelesai');
    const tamuList = document.getElementById('tamuList');
    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    const closeModal = document.querySelector('.close');
    const cancelEdit = document.getElementById('cancelEdit');
    const deleteModal = document.getElementById('deleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const exportBtn = document.getElementById('exportBtn');
    const printBtn = document.getElementById('printBtn');

    // Statistik Elements
    const totalTamu = document.getElementById('totalTamu');
    const tamuHariIni = document.getElementById('tamuHariIni');
    const tamuBulanIni = document.getElementById('tamuBulanIni');

    // State
    let tamuData = [];
    let currentDeleteId = null;

    // Load data saat aplikasi dimulai
    await loadTamuData();

    // Auto-refresh data setiap 30 detik
    setInterval(async () => {
        try {
            await loadTamuData();
        } catch (error) {
            console.error('Error auto-refreshing data:', error);
        }
    }, 30000);

    // Event Listeners
    tamuForm.addEventListener('submit', handleSubmit);
    resetBtn.addEventListener('click', resetForm);
    reloadBtn.addEventListener('click', handleReload);
    searchInput.addEventListener('input', handleSearch);
    filterTanggalMulai.addEventListener('change', handleSearch);
    filterTanggalSelesai.addEventListener('change', handleSearch);
    closeModal.addEventListener('click', closeEditModal);
    cancelEdit.addEventListener('click', closeEditModal);
    editForm.addEventListener('submit', handleEdit);
    cancelDelete.addEventListener('click', () => deleteModal.style.display = 'none');
    confirmDelete.addEventListener('click', handleDeleteConfirm);
    if (exportBtn) exportBtn.addEventListener('click', handleExportCSV);
    if (printBtn) printBtn.addEventListener('click', handlePrintPDF);

    // Functions
    async function loadTamuData() {
        try {
            tamuData = await window.electronAPI.getTamu();
            console.log('Data tamu loaded:', tamuData);
            renderTamuList(tamuData);
            updateStats(tamuData);
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Error', 'Gagal memuat data tamu');
        }
    }

    async function handleReload() {
        try {
            // Tambahkan class rotating untuk animasi
            reloadBtn.classList.add('rotating');
            
            // Reload data
            await loadTamuData();
            
            // Hapus class rotating setelah selesai
            reloadBtn.classList.remove('rotating');
            
            showNotification('Sukses', 'Data berhasil diperbarui');
        } catch (error) {
            console.error('Error reloading data:', error);
            showNotification('Error', 'Gagal memperbarui data');
            reloadBtn.classList.remove('rotating');
        }
    }

    function updateStats(tamu) {
        const totalTamu = tamu.length;
        const today = new Date().toLocaleDateString();
        const tamuHariIni = tamu.filter(t => 
            new Date(t.tanggal).toLocaleDateString() === today
        ).length;

        document.getElementById('totalTamu').textContent = totalTamu;
        document.getElementById('tamuHariIni').textContent = tamuHariIni;
        document.getElementById('tamuBulanIni').textContent = tamu.filter(t => {
            const date = new Date(t.tanggal);
            return date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
        }).length;
    }

    function renderTamuList(data) {
        tamuList.innerHTML = '';
        if (data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="7" style="text-align: center;">Belum ada data tamu</td>';
            tamuList.appendChild(row);
            return;
        }

        data.forEach((tamu, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${formatDate(tamu.tanggal)}</td>
                <td>${tamu.nama}</td>
                <td>${tamu.instansi}</td>
                <td>${tamu.keperluan}</td>
                <td>${tamu.catatan || '-'}</td>
                <td class="action-buttons">
                    <button class="icon-btn edit-btn" data-id="${tamu.id}" title="Edit">✏️</button>
                    <button class="icon-btn copy-btn" data-id="${tamu.id}" title="Salin Data">📋</button>
                    <button class="icon-btn delete-btn" data-id="${tamu.id}" title="Hapus">🗑️</button>
                </td>
            `;
            tamuList.appendChild(row);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', handleEditClick);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteClick);
        });

        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', handleCopyClick);
        });
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function validateForm(tamu) {
        if (!tamu.nama || !tamu.instansi || !tamu.keperluan || !tamu.tanggal) {
            throw new Error('Mohon lengkapi semua data yang diperlukan');
        }
        // Bandingkan hanya tanggal (tanpa jam)
        const selectedDate = new Date(tamu.tanggal);
        const today = new Date();
        selectedDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        if (selectedDate > today) {
            throw new Error('Tanggal kunjungan tidak boleh di masa depan');
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(tamuForm);
        const tamu = {
            id: document.getElementById('tamuId').value,
            nama: formData.get('nama'),
            instansi: formData.get('instansi'),
            keperluan: formData.get('keperluan'),
            tanggal: formData.get('tanggal'),
            catatan: formData.get('catatan')
        };

        try {
            validateForm(tamu);

            if (tamu.id) {
                const result = await window.electronAPI.updateTamu(tamu);
                if (result) {
                    showNotification('Sukses', 'Data tamu berhasil diperbarui');
                    resetForm();
                    await loadTamuData();
                }
            } else {
                const result = await window.electronAPI.addTamu(tamu);
                if (result) {
                    showNotification('Sukses', 'Data tamu berhasil disimpan');
                    resetForm();
                    await loadTamuData();
                }
            }
        } catch (error) {
            console.error('Error saving tamu:', error);
            // Hanya tampilkan notifikasi error jika benar-benar gagal
            if (error.message) {
                showNotification('Error', error.message);
            }
        }
    }

    function resetForm() {
        tamuForm.reset();
        document.getElementById('tamuId').value = '';
        document.getElementById('submitBtn').textContent = 'Simpan';
    }

    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const tanggalMulai = filterTanggalMulai.value;
        const tanggalSelesai = filterTanggalSelesai.value;

        const filteredData = tamuData.filter(tamu => {
            const matchesSearch = 
                tamu.nama.toLowerCase().includes(searchTerm) ||
                tamu.instansi.toLowerCase().includes(searchTerm);
            
            const tamuDate = new Date(tamu.tanggal);
            const startDate = tanggalMulai ? new Date(tanggalMulai) : null;
            const endDate = tanggalSelesai ? new Date(tanggalSelesai) : null;

            const matchesDate = (!startDate || tamuDate >= startDate) && 
                              (!endDate || tamuDate <= endDate);

            return matchesSearch && matchesDate;
        });

        renderTamuList(filteredData);
    }

    function handleEditClick(e) {
        const id = e.target.dataset.id;
        const tamu = tamuData.find(t => t.id === id);
        if (tamu) {
            document.getElementById('tamuId').value = tamu.id;
            document.getElementById('nama').value = tamu.nama;
            document.getElementById('instansi').value = tamu.instansi;
            document.getElementById('keperluan').value = tamu.keperluan;
            document.getElementById('tanggal').value = tamu.tanggal;
            document.getElementById('catatan').value = tamu.catatan || '';
            document.getElementById('submitBtn').textContent = 'Update';
            
            // Scroll ke form
            document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
        }
    }

    async function handleEdit(e) {
        e.preventDefault();
        const tamu = {
            id: document.getElementById('editId').value,
            nama: document.getElementById('editNama').value,
            instansi: document.getElementById('editInstansi').value,
            keperluan: document.getElementById('editKeperluan').value,
            tanggal: document.getElementById('editTanggal').value,
            catatan: document.getElementById('editCatatan').value
        };

        try {
            if (!tamu.nama || !tamu.instansi || !tamu.keperluan || !tamu.tanggal) {
                throw new Error('Mohon lengkapi semua data yang diperlukan');
            }

            await window.electronAPI.updateTamu(tamu);
            closeEditModal();
            loadTamuData();
            showNotification('Sukses', 'Data tamu berhasil diperbarui');
        } catch (error) {
            console.error('Error updating tamu:', error);
            showNotification('Error', 'Gagal memperbarui data tamu');
        }
    }

    function handleDeleteClick(e) {
        currentDeleteId = e.target.dataset.id;
        deleteModal.style.display = 'block';
    }

    async function handleDeleteConfirm() {
        if (currentDeleteId) {
            try {
                await window.electronAPI.deleteTamu(currentDeleteId);
                deleteModal.style.display = 'none';
                loadTamuData();
                showNotification('Sukses', 'Data tamu berhasil dihapus');
            } catch (error) {
                console.error('Error deleting tamu:', error);
                showNotification('Error', 'Gagal menghapus data tamu');
            }
        }
    }

    function closeEditModal() {
        editModal.style.display = 'none';
        editForm.reset();
    }

    function showNotification(title, message) {
        if (window.electronAPI) {
            window.electronAPI.showNotification(title, message);
        } else {
            alert(`${title}: ${message}`);
        }
    }

    function handleCopyClick(e) {
        const id = e.target.dataset.id;
        const tamu = tamuData.find(t => t.id === id);
        if (tamu) {
            const textToCopy = `
Nama: ${tamu.nama}
Instansi: ${tamu.instansi}
Keperluan: ${tamu.keperluan}
Tanggal: ${formatDate(tamu.tanggal)}
Catatan: ${tamu.catatan || '-'}
            `.trim();
            
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    showNotification('Sukses', 'Data tamu berhasil disalin ke clipboard');
                })
                .catch(err => {
                    console.error('Error copying text:', err);
                    showNotification('Error', 'Gagal menyalin data');
                });
        }
    }

    async function handleExportCSV() {
        try {
            let data = await window.electronAPI.getTamu();
            const headers = ['No', 'Tanggal', 'Nama', 'Instansi', 'Keperluan', 'Catatan'];
            
            // Buat header tabel dengan pemisah yang lebih jelas
            const headerRow = headers.join(',');
            const separatorRow = headers.map(() => '---').join(',');
            
            // Format data dengan pemisah yang lebih jelas
            const dataRows = data.map((tamu, idx) => {
                return [
                    idx + 1,
                    formatDate(tamu.tanggal),
                    escapeCsvField(tamu.nama),
                    escapeCsvField(tamu.instansi),
                    escapeCsvField(tamu.keperluan),
                    escapeCsvField(tamu.catatan || '')
                ].join(',');
            });

            // Gabungkan semua baris dengan pemisah yang jelas
            const csvContent = '\uFEFF' + [
                headerRow,
                separatorRow,
                ...dataRows
            ].join('\r\n');

            const fileName = `buku-tamu-${new Date().toISOString().split('T')[0]}.csv`;
            const result = await window.electronAPI.exportCSV(csvContent, fileName);
            if (result) showNotification('Sukses', 'Export CSV berhasil!');
            else showNotification('Error', 'Export CSV dibatalkan.');
        } catch (err) {
            showNotification('Error', 'Export CSV gagal!');
        }
    }

    function escapeCsvField(field) {
        if (field == null) return '""';
        const s = String(field).replace(/\r?\n|\r/g, ' ');
        if (s.includes(',') || s.includes('"')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }

    async function handlePrintPDF() {
        try {
            // Sembunyikan elemen yang tidak perlu dicetak
            document.querySelectorAll('.form-section, .stats-section, .filter-box, .section-header .btn, .modal, .action-buttons, th:last-child').forEach(el => {
                if (el) el.classList.add('print-hide');
            });
            const result = await window.electronAPI.exportPDF();
            setTimeout(() => {
                document.querySelectorAll('.form-section, .stats-section, .filter-box, .section-header .btn, .modal, .action-buttons, th:last-child').forEach(el => {
                    if (el) el.classList.remove('print-hide');
                });
            }, 500);
            if (result) showNotification('Sukses', 'Export PDF berhasil!');
            else showNotification('Error', 'Export PDF dibatalkan.');
        } catch (err) {
            showNotification('Error', 'Export PDF gagal!');
        }
    }

    console.log('window.electronAPI:', window.electronAPI);
});

// Export functions to window for button onclick handlers
window.editTamu = async (index) => {
    try {
        const tamu = await window.electronAPI.getTamu();
        const selectedTamu = tamu[index];
        
        document.getElementById('editNama').value = selectedTamu.nama;
        document.getElementById('editInstansi').value = selectedTamu.instansi;
        document.getElementById('editKeperluan').value = selectedTamu.keperluan;
        document.getElementById('editIndex').value = index;
        
        const editModal = new bootstrap.Modal(document.getElementById('editModal'));
        editModal.show();
    } catch (error) {
        console.error('Error preparing edit:', error);
        showNotification('Error', 'Gagal memuat data untuk diedit');
    }
};

window.deleteTamu = async (index) => {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
        try {
            await window.electronAPI.deleteTamu(index);
            const updatedTamu = await window.electronAPI.getTamu();
            renderTamuList(updatedTamu);
            updateStats(updatedTamu);
            showNotification('Sukses', 'Data tamu berhasil dihapus');
        } catch (error) {
            console.error('Error deleting tamu:', error);
            showNotification('Error', 'Gagal menghapus data tamu');
        }
    }
}; 