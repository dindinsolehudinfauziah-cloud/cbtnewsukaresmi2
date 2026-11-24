import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExamResult, SchoolSettings } from '../types/database';

export function formatDateTimeID(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatGradingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'auto_graded':
      return 'Dinilai Otomatis (PG)';
    case 'needs_essay_grading':
      return 'Menunggu Koreksi Essay';
    case 'graded':
      return 'Selesai Dinilai';
    default:
      return '-';
  }
}

export async function exportResultsToExcel(
  results: ExamResult[],
  fileNamePrefix = 'Laporan_Nilai_CBT_SMPN2_Sukaresmi'
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CBT SMP Negeri 2 Sukaresmi';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Hasil Ujian');
  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'NIS', key: 'nis', width: 14 },
    { header: 'NISN', key: 'nisn', width: 16 },
    { header: 'Nama Siswa', key: 'nama', width: 28 },
    { header: 'Kelas', key: 'kelas', width: 12 },
    { header: 'Judul Ujian', key: 'ujian', width: 30 },
    { header: 'Mata Pelajaran', key: 'mapel', width: 22 },
    { header: 'Benar PG', key: 'benar_pg', width: 12 },
    { header: 'Nilai PG', key: 'nilai_pg', width: 12 },
    { header: 'Nilai Essay', key: 'nilai_essay', width: 12 },
    { header: 'Nilai Akhir', key: 'nilai_akhir', width: 13 },
    { header: 'Status Penilaian', key: 'status_nilai', width: 24 },
    { header: 'Status Publikasi', key: 'publikasi', width: 18 },
    { header: 'Tanggal Nilai', key: 'tanggal', width: 22 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };

  results.forEach((r, index) => {
    sheet.addRow({
      no: index + 1,
      nis: r.students?.nis || '-',
      nisn: r.students?.nisn || '-',
      nama: r.students?.profiles?.full_name || '-',
      kelas: r.students?.classes?.name || r.exams?.classes?.name || '-',
      ujian: r.exams?.title || '-',
      mapel: r.exams?.subjects?.name || '-',
      benar_pg: `${r.pg_correct_count}/${r.pg_total_count}`,
      nilai_pg: Number(r.pg_score ?? 0),
      nilai_essay: Number(r.essay_score ?? 0),
      nilai_akhir: Number(r.final_score ?? 0),
      status_nilai: formatGradingStatusLabel(r.grading_status),
      publikasi: r.is_published ? 'Diumumkan' : 'Belum Diumumkan',
      tanggal: formatDateTimeID(r.updated_at),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${fileNamePrefix}_${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportResultsToPdf(
  results: ExamResult[],
  schoolSettings: SchoolSettings | null,
  filterSummary: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const schoolName = schoolSettings?.school_name || 'SMP NEGERI 2 SUKARESMI';
  const address = schoolSettings?.address || 'Kabupaten Cianjur, Jawa Barat';
  const npsn = schoolSettings?.npsn || '-';

  // Kop Surat Resmi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(schoolName.toUpperCase(), 148.5, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`NPSN: ${npsn} · ${address}`, 148.5, 19.5, { align: 'center' });

  doc.setLineWidth(0.6);
  doc.line(14, 23, 283, 23);
  doc.setLineWidth(0.2);
  doc.line(14, 24, 283, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('LAPORAN HASIL UJIAN SEMESTER ONLINE (CBT)', 148.5, 31, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Filter: ${filterSummary || 'Semua Ujian & Kelas'}`, 14, 37);
  doc.text(
    `Dicetak pada: ${formatDateTimeID(new Date().toISOString())} · Total Peserta: ${results.length}`,
    283,
    37,
    { align: 'right' }
  );

  const avgScore =
    results.length > 0
      ? (results.reduce((acc, r) => acc + Number(r.final_score || 0), 0) / results.length).toFixed(2)
      : '0.00';

  const tableBody = results.map((r, idx) => [
    String(idx + 1),
    r.students?.nis || '-',
    r.students?.profiles?.full_name || '-',
    r.students?.classes?.name || r.exams?.classes?.name || '-',
    r.exams?.subjects?.name || '-',
    r.exams?.title || '-',
    `${r.pg_correct_count}/${r.pg_total_count}`,
    Number(r.pg_score ?? 0).toFixed(1),
    Number(r.essay_score ?? 0).toFixed(1),
    Number(r.final_score ?? 0).toFixed(1),
    r.is_published ? 'Diumumkan' : 'Draft',
  ]);

  autoTable(doc, {
    startY: 41,
    head: [
      [
        'No',
        'NIS',
        'Nama Siswa',
        'Kelas',
        'Mata Pelajaran',
        'Ujian',
        'PG',
        'Skor PG',
        'Skor Essay',
        'Nilai Akhir',
        'Status',
      ],
    ],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 22 },
      3: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 17 },
      8: { halign: 'right', cellWidth: 19 },
      9: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      10: { halign: 'center', cellWidth: 20 },
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 50;
  const footerY = Math.min(finalY + 10, 175);

  doc.setFontSize(9);
  doc.text(`Rata-rata Nilai Akhir: ${avgScore}`, 14, footerY);

  doc.text('Mengetahui,', 230, footerY);
  doc.text('Kepala Sekolah', 230, footerY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolSettings?.headmaster_name || 'Kepala Sekolah', 230, footerY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolSettings?.headmaster_nip || '-'}`, 230, footerY + 25);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_CBT_SMPN2_Sukaresmi_${stamp}.pdf`);
}
