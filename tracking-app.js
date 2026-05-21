// Inisialisasi instance Vue baru
new Vue({
    // Mengaitkan Vue dengan elemen DOM ber-ID 'trackingApp'
    el: '#trackingApp',
    
    // State lokal data untuk aplikasi tracking
    data: {
        pageTitle: 'Tracking Delivery Order',
        // Mengambil objek simulasi tracking DO dari window.dataUT
        trackingData: window.dataUT.tracking, 
        // Mengambil array pengiriman ekspedisi
        pengirimanList: window.dataUT.pengirimanList,
        // Mengambil array daftar paket bahan ajar
        paketList: window.dataUT.paket,
        // Mengambil array daftar stok bahan ajar (untuk lookup detail)
        stokData: window.dataUT.stok,
        
        // Array untuk menyimpan nomor DO mana saja yang baris tabelnya sedang "expanded" (terbuka)
        expandedRows: [], 
        
        // State form untuk DO baru (dua arah / v-model)
        form: {
            nim: '',
            nama: '',
            ekspedisi: '',
            paketKode: '',
            tanggalKirim: '',
            total: 0 // Harga total otomatis diisi dari paket yang dipilih
        },
        // Menyimpan pesan validasi form
        errors: {},
        // Menyimpan list data yang sudah dilookup untuk paket yang baru saja dipilih form
        detailPaketTerpilih: [] 
    },
    
    // Computed Properties: Variabel turunan yang diproses otomatis dengan caching. (Sesuai Requirement: Filter pakai computed)
    computed: {
        // Computed 1: Mengonversi `trackingData` (yang berupa Object) menjadi Array agar bisa di-loop dengan v-for
        trackingList() {
            // Object.entries mengubah objek menjadi array kunci (key) dan nilai (value)
            return Object.entries(this.trackingData).map(([key, value]) => {
                return {
                    noDO: key, // Memasukkan nomor DO (key) ke dalam object
                    ...value // Meng-copy semua properti lain menggunakan spread operator
                };
            }).sort((a, b) => b.noDO.localeCompare(a.noDO)); // Mengurutkan nomor DO (paling baru di atas)
        },
        
        // Computed 2: Secara otomatis membuat nomor DO baru menggunakan template string (Requirement)
        generateNoDO() {
            const year = new Date().getFullYear(); // Ambil tahun saat ini
            
            // Hitung berapa DO yang sudah terbit di tahun ini (filter array keys)
            const doTahunIni = Object.keys(this.trackingData).filter(k => k.startsWith(`DO${year}`));
            
            // Sequence increment +1 dari panjang array DO tahun ini
            const seq = doTahunIni.length + 1;
            
            // Format format DO{tahun}-{seq 3 digit} (contoh: DO2025-001) dengan padStart agar otomatis tambah angka 0
            return `DO${year}-${String(seq).padStart(3, '0')}`;
        },
        
        // Computed 3: Memvalidasi reaktif, dipanggil oleh v-bind:disabled di HTML tombol
        isFormValid() {
            return this.validateForm(false); // False agar error message tidak tampil di UI langsung
        }
    },
    
    // Watchers: Fitur reaktif untuk menangkap setiap event perubahan pada data spesifik dan menjalankan logika side-effect
    watch: {
        // Watcher 2 (Requirement): Watch paketKode untuk me-lookup isi paket beserta harga
        'form.paketKode': function(newKode) {
            // Jika ada kode paket yang dipilih
            if (newKode) {
                // Cari objek lengkap dari paketList
                const selectedPaket = this.paketList.find(p => p.kode === newKode);
                if (selectedPaket) {
                    // Update state total harga di dalam form otomatis (Requirement: Auto-ambil harga)
                    this.form.total = selectedPaket.harga;
                    
                    // Lookup isi array string kode MK ke array detail objek menggunakan .map
                    this.detailPaketTerpilih = selectedPaket.isi.map(kodeMK => {
                        const mkStok = this.stokData.find(s => s.kode === kodeMK);
                        // Jika MK ditemukan di tabel stok, ambil judul, jika tidak fallback default
                        return mkStok ? 
                            { kode: kodeMK, judul: mkStok.judul, harga: mkStok.harga } : 
                            { kode: kodeMK, judul: "Bahan Ajar Tidak Ditemukan", harga: 0 };
                    });
                }
            } else {
                // Reset form harga dan detail array jika user men-deselect combo box
                this.form.total = 0;
                this.detailPaketTerpilih = [];
            }
        }
    },
    
    // Methods: Seluruh action logic, event listener, dan formatters
    methods: {
        // Method formatter untuk mencetak nilai tukar rupiah (di HTML)
        formatRupiah(number) {
            return "Rp " + (number || 0).toLocaleString('id-ID');
        },
        
        // Method helper untuk mengambil nama panjang ekspedisi dari kodenya
        getNamaEkspedisi(kode) {
            const eks = this.pengirimanList.find(e => e.kode === kode);
            return eks ? eks.nama : kode;
        },
        
        // Method: Dinamis menetapkan label badge warna di HTML untuk kolom Status
        getStatusBadgeClass(status) {
            if (status.toLowerCase() === 'selesai') return 'status-aman'; // Hijau
            if (status.toLowerCase() === 'proses') return 'status-menipis'; // Orange
            return 'status-kosong'; // Merah (Atau warna lain untuk Dikirim / lain-lain)
        },
        
        // Method event listener: untuk memperluas info tracking accordion pada grid tabel
        toggleDetail(noDO) {
            // Mencari apakah DO yang diklik sudah ada di dalam array baris yang expanded
            const idx = this.expandedRows.indexOf(noDO);
            if (idx > -1) {
                // Jika sudah ada, hapus dari array agar baris detail tertutup di HTML (v-if)
                this.expandedRows.splice(idx, 1);
            } else {
                // Jika tidak ada, push ke array sehingga baris detail terbuka
                this.expandedRows.push(noDO);
            }
        },
        
        // Method event listener: Memperbarui v-model form tanggal secara manual melalui klik satu tombol 
        setHariIni() {
            // Dapatkan string waktu dalam format "YYYY-MM-DD"
            this.form.tanggalKirim = new Date().toISOString().split('T')[0];
        },
        
        // Method validasi: Mengecek kondisi form DO baru
        validateForm(showErrors = true) {
            let isValid = true;
            let tempErrors = {};
            
            // Regex NIM yang meminta presisi mutlak pada 9 digit angka (Requirement form validasi sederhana)
            const nimRegex = /^[0-9]{9}$/;
            if (!this.form.nim) {
                tempErrors.nim = "NIM wajib diisi.";
                isValid = false;
            } else if (!nimRegex.test(this.form.nim)) {
                tempErrors.nim = "NIM harus 9 digit angka.";
                isValid = false;
            }
            
            // Nama tidak boleh kurang dari 3 huruf
            if (!this.form.nama || this.form.nama.length < 3) {
                tempErrors.nama = "Nama minimal 3 karakter.";
                isValid = false;
            }
            
            // Ekspedisi drop-down wajib dicek keberadaannya
            if (!this.form.ekspedisi) {
                tempErrors.ekspedisi = "Pilih ekspedisi pengiriman.";
                isValid = false;
            }
            
            // Paket dropdown bahan ajar tidak boleh null/blank
            if (!this.form.paketKode) {
                tempErrors.paketKode = "Pilih paket bahan ajar.";
                isValid = false;
            }
            
            // Datepicker HTML 5 harus terisi
            if (!this.form.tanggalKirim) {
                tempErrors.tanggalKirim = "Tanggal kirim wajib diisi.";
                isValid = false;
            }
            
            // Assign error ke global state jika parameternya di atur "true" (di trigger dari tombol Submit)
            if (showErrors) {
                this.errors = Object.assign({}, tempErrors);
            }
            
            return isValid;
        },
        
        // Event handler Form Tambah DO saat disubmit
        submitForm() {
            // Memanggil method validasi. Jika return value "true", lanjutkan pembuatan DO
            if (this.validateForm(true)) {
                // Jalankan fungsi computed generator nomor DO otomatis (DO202x-xxx)
                const newNoDO = this.generateNoDO;
                const now = new Date(); // Instance waktu persis pas di-submit
                
                // Format string waktu menggunakan padStart ke format "YYYY-MM-DD HH:MM"
                const timeString = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                
                // Karena this.trackingData adalah Object dan BUKAN Array, penambahan propesti/key
                // object baru di Vue versi 2 wajib menggunakan "Vue.set" agar secara otomatis menjadi reactive.
                Vue.set(this.trackingData, newNoDO, {
                    nim: this.form.nim,
                    nama: this.form.nama,
                    status: "Proses",
                    ekspedisi: this.form.ekspedisi,
                    tanggalKirim: this.form.tanggalKirim,
                    paket: this.form.paketKode,
                    total: this.form.total, // Hasil total yang di set watcher di atas
                    perjalanan: [
                        { waktu: timeString, keterangan: "DO dibuat dan menunggu proses gudang" }
                    ]
                });
                
                // Reset/kosongkan state formulir yang terhubung oleh v-model agar form di UI menjadi kosong kembali
                this.form = {
                    nim: '', nama: '', ekspedisi: '', paketKode: '', 
                    tanggalKirim: '', total: 0
                };
                this.errors = {}; // Reset container error UI
                
                // Alert popup javascript feedback bahwa DO telah jadi (bisa diganti toast notification)
                alert(`DO ${newNoDO} berhasil dibuat!`);
            }
        }
    }
});
