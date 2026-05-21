// Inisialisasi instance Vue baru
new Vue({
    // Binding instance Vue ke elemen HTML dengan id 'stokApp'
    el: '#stokApp',
    
    // Data (state) aplikasi
    data: {
        // Mengambil data stok dari variabel global window.dataUT
        stokData: window.dataUT.stok,
        // Mengambil daftar UPBJJ dari variabel global window.dataUT
        upbjjList: window.dataUT.upbjjList,
        // Mengambil daftar kategori dari variabel global window.dataUT
        kategoriList: window.dataUT.kategoriList,
        // State boolean untuk menampilkan atau menyembunyikan form tambah stok
        showForm: false,
        
        // State untuk menyimpan nilai-nilai filter & sorting
        filter: {
            selectedUpbjj: '', // Menyimpan UPBJJ yang dipilih pengguna
            selectedKategori: '', // Menyimpan Kategori yang dipilih pengguna (dependent filter)
            hanyaKritis: false, // Menyimpan status checkbox filter stok kritis
            sortBy: 'judul', // Field default untuk pengurutan tabel
            sortOrder: 'asc' // Arah pengurutan default (ascending/naik)
        },
        
        // State untuk menampung data form input bahan ajar baru (v-model di form)
        formTambah: {
            kode: '',
            judul: '',
            kategori: '',
            upbjj: '',
            lokasiRak: '',
            harga: 0,
            qty: 0,
            safety: 0,
            catatanHTML: '' // Field yang nanti dirender menggunakan v-html
        },
        // State untuk menyimpan pesan error saat validasi form
        errors: {},
        
        // State untuk fitur Inline Edit pada tabel
        editIndex: -1, // Menyimpan index baris yang sedang diedit (-1 berarti tidak ada)
        editForm: {
            qty: 0, // Nilai sementara qty saat diedit
            safety: 0 // Nilai sementara safety stok saat diedit
        }
    },
    
    // Computed Properties: property turunan yang bersifat cached dan hanya dihitung ulang bila dependency-nya berubah
    computed: {
        // Computed filter & sorting (Sesuai Requirement: Filter wajib pakai computed)
        filteredStok() {
            // Salin array stok awal untuk dimanipulasi
            let result = this.stokData;
            
            // 1. Kondisional: Jika UPBJJ dipilih, filter array berdasarkan upbjj
            if (this.filter.selectedUpbjj) {
                result = result.filter(item => item.upbjj === this.filter.selectedUpbjj);
            }
            
            // 2. Kondisional: Dependent options, Kategori hanya difilter jika UPBJJ sudah ada dan Kategori dipilih
            if (this.filter.selectedUpbjj && this.filter.selectedKategori) {
                result = result.filter(item => item.kategori === this.filter.selectedKategori);
            }
            
            // 3. Kondisional: Jika dicentang, hanya tampilkan item di mana qty di bawah safety atau qty 0
            if (this.filter.hanyaKritis) {
                result = result.filter(item => item.qty < item.safety || item.qty === 0);
            }
            
            // 4. Sorting: Urutkan hasil array berdasarkan field yang dipilih
            result.sort((a, b) => {
                let valA = a[this.filter.sortBy]; // Ambil nilai A untuk sorting
                let valB = b[this.filter.sortBy]; // Ambil nilai B untuk sorting
                
                // Jika tipenya string, ubah ke lowercase agar pengurutan tidak case-sensitive
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                
                let comparison = 0;
                // Logika pengurutan naik
                if (valA > valB) comparison = 1;
                if (valA < valB) comparison = -1;
                
                // Kembalikan hasil perbandingan (dikalikan -1 jika descending/turun)
                return this.filter.sortOrder === 'asc' ? comparison : (comparison * -1);
            });
            
            // Kembalikan hasil filter dan urutkan
            return result;
        },
        
        // Computed: Secara otomatis menghitung saran safety stok (30% dari qty form)
        suggestedSafety() {
            return Math.ceil((this.formTambah.qty || 0) * 0.3);
        },
        
        // Computed: Mengecek apakah form secara keseluruhan valid untuk mengaktifkan/mematikan tombol Submit (v-bind:disabled)
        isFormValid() {
            // Panggil method validasi tapi false agar error belum muncul ke UI
            return this.validateForm(false);
        }
    },
    
    // Watchers: Menjalankan side-effect saat suatu data tertentu berubah
    watch: {
        // Watcher 1: Mengamati state `filter.selectedUpbjj`
        // Ketika UPBJJ berubah, reset Kategori ke string kosong (Requirement dependent options)
        'filter.selectedUpbjj': function(newVal) {
            this.filter.selectedKategori = '';
        },
        
        // Watcher Bonus: Memantau qty saat pengisian form
        // Jika safety stock masih 0 dan user mengisi qty, auto-isi safety stock
        'formTambah.qty': function(newVal) {
            if (this.formTambah.safety === 0 && newVal > 0) {
                this.formTambah.safety = Math.ceil(newVal * 0.3);
            }
        }
    },
    
    // Methods: Kumpulan fungsi/event handler yang selalu dijalankan setiap kali dipanggil
    methods: {
        // Method: Mengembalikan nama class CSS berdasarkan perbandingan stok (Sesuai Requirement: 3 warna)
        getStatusClass(item) {
            if (item.qty === 0) return 'status-kosong'; // Merah
            if (item.qty < item.safety) return 'status-menipis'; // Orange
            return 'status-aman'; // Hijau
        },
        
        // Method: Mereset semua state filter kembali ke nilai awal
        resetFilter() {
            this.filter.selectedUpbjj = '';
            this.filter.selectedKategori = '';
            this.filter.hanyaKritis = false;
            this.filter.sortBy = 'judul';
            this.filter.sortOrder = 'asc';
        },
        
        // Method: Memvalidasi form input (Requirement: validasi form minimal)
        validateForm(showErrors = true) {
            let isValid = true;
            let tempErrors = {};
            
            // Aturan Regex untuk validasi kode buku agar hanya alphanumeric
            const alphanumeric = /^[a-zA-Z0-9]+$/;
            
            // Validasi Kode: Wajib diisi, harus alphanumeric, dan unik
            if (!this.formTambah.kode) {
                tempErrors.kode = "Kode wajib diisi.";
                isValid = false;
            } else if (!alphanumeric.test(this.formTambah.kode)) {
                tempErrors.kode = "Kode harus alphanumeric.";
                isValid = false;
            } else if (this.stokData.some(item => item.kode === this.formTambah.kode)) {
                tempErrors.kode = "Kode sudah ada dalam database.";
                isValid = false;
            }
            
            // Validasi Judul: Wajib diisi minimal 3 karakter
            if (!this.formTambah.judul || this.formTambah.judul.length < 3) {
                tempErrors.judul = "Judul wajib diisi minimal 3 karakter.";
                isValid = false;
            }
            
            // Validasi Kategori: Wajib dipilih
            if (!this.formTambah.kategori) {
                tempErrors.kategori = "Kategori wajib dipilih.";
                isValid = false;
            }
            
            // Validasi UPBJJ: Wajib dipilih
            if (!this.formTambah.upbjj) {
                tempErrors.upbjj = "UPBJJ wajib dipilih.";
                isValid = false;
            }
            
            // Validasi Harga: Tidak boleh angka negatif
            if (this.formTambah.harga < 0) {
                tempErrors.harga = "Harga tidak boleh negatif.";
                isValid = false;
            }
            
            // Validasi Qty: Tidak boleh angka negatif
            if (this.formTambah.qty < 0) {
                tempErrors.qty = "Qty tidak boleh negatif.";
                isValid = false;
            }
            
            // Validasi Safety Stock: Tidak boleh angka negatif
            if (this.formTambah.safety < 0) {
                tempErrors.safety = "Safety stok tidak boleh negatif.";
                isValid = false;
            }
            
            // Menampilkan error ke layar jika argumen di-pass true
            if (showErrors) {
                this.errors = Object.assign({}, tempErrors); // Copy data error ke object Vue
            }
            
            return isValid; // Return true jika validasi lolos semua
        },
        
        // Method: Menangani saat pengguna mensubmit form (dipanggil di tag form lewat @submit.prevent)
        submitForm() {
            // Lakukan validasi satu kali lagi yang merender tulisan merah
            if (this.validateForm(true)) {
                // Menambahkan object baru ke dalam state array stokData
                this.stokData.push({
                    kode: this.formTambah.kode,
                    judul: this.formTambah.judul,
                    kategori: this.formTambah.kategori,
                    upbjj: this.formTambah.upbjj,
                    lokasiRak: this.formTambah.lokasiRak || '-',
                    harga: this.formTambah.harga,
                    qty: this.formTambah.qty,
                    safety: this.formTambah.safety,
                    catatanHTML: this.formTambah.catatanHTML // HTML akan aman berkat v-html saat di render
                });
                
                // Mengosongkan isian state formTambah kembali
                this.formTambah = {
                    kode: '', judul: '', kategori: '', upbjj: '', 
                    lokasiRak: '', harga: 0, qty: 0, safety: 0, catatanHTML: ''
                };
                
                // Mengosongkan error dan sembunyikan kotak form
                this.errors = {};
                this.showForm = false;
                
                // Gulir halaman ke bawah ke bagian tabel
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        },
        
        // Method: Untuk fitur Inline Editing, dipanggil saat klik tombol Edit
        startEdit(index, item) {
            this.editIndex = index; // Menandai baris ke-berapa yang aktif di tabel
            this.editForm.qty = item.qty; // Menyalin qty lama
            this.editForm.safety = item.safety; // Menyalin safety lama
        },
        
        // Method: Untuk menyimpan hasil fitur Inline Editing
        saveEdit(index) {
            if (this.editForm.qty >= 0 && this.editForm.safety >= 0) {
                // Mencari target object asli menggunakan reference dari array hasil filter
                const realItem = this.filteredStok[index];
                const realIndex = this.stokData.findIndex(d => d.kode === realItem.kode && d.upbjj === realItem.upbjj);
                
                if (realIndex !== -1) {
                    // Simpan data qty dan safety baru ke object asli
                    this.stokData[realIndex].qty = this.editForm.qty;
                    this.stokData[realIndex].safety = this.editForm.safety;
                }
                // Kembalikan state editing ke -1 (Matikan mode edit)
                this.editIndex = -1;
            } else {
                alert("Nilai tidak boleh negatif!");
            }
        },
        
        // Method: Membatalkan mode Inline Edit
        cancelEdit() {
            this.editIndex = -1; // Reset agar semua input box di tabel menghilang
        }
    }
});
