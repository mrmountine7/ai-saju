import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface SajuResult {
  name: string;
  birthDate: string;
  gender: string;
  pillars?: {
    year?: { heavenly_stem: string; earthly_branch: string };
    month?: { heavenly_stem: string; earthly_branch: string };
    day?: { heavenly_stem: string; earthly_branch: string };
    hour?: { heavenly_stem: string; earthly_branch: string };
  };
  analysis?: {
    daily_master_analysis?: string;
    geuk_analysis?: string;
    synthesis?: string;
    easy_explanation?: string;
  };
  classical_references?: Array<{
    source: string;
    content: string;
  }>;
}

const PILLAR_LABELS = ['시주', '일주', '월주', '연주'];

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  } catch {
    return dateStr;
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/---/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

export async function generatePDFFromElement(
  elementId: string,
  filename: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#1e293b',
    logging: false,
  });

  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  const pdf = new jsPDF({
    orientation: imgHeight > imgWidth * 1.5 ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  let position = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let remainingHeight = imgHeight;

  while (remainingHeight > 0) {
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    remainingHeight -= pageHeight;
    position -= pageHeight;
    
    if (remainingHeight > 0) {
      pdf.addPage();
    }
  }

  pdf.save(filename);
}

export async function generateSajuPDF(result: SajuResult): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  pdf.setFillColor(30, 41, 59);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.text('AI 사주 분석 리포트', pageWidth / 2, yPosition + 10, { align: 'center' });
  
  yPosition += 25;
  
  pdf.setDrawColor(245, 158, 11);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 15;

  pdf.setFontSize(12);
  pdf.setTextColor(200, 200, 200);
  pdf.text(`이름: ${result.name}`, margin, yPosition);
  pdf.text(`생년월일: ${formatDate(result.birthDate)}`, margin + 60, yPosition);
  pdf.text(`성별: ${result.gender === 'M' ? '남성' : '여성'}`, margin + 140, yPosition);
  
  yPosition += 20;

  if (result.pillars) {
    pdf.setFontSize(14);
    pdf.setTextColor(245, 158, 11);
    pdf.text('사주팔자', margin, yPosition);
    yPosition += 10;
    
    const pillars = [
      result.pillars.hour,
      result.pillars.day,
      result.pillars.month,
      result.pillars.year,
    ];
    
    const boxWidth = (pageWidth - margin * 2 - 15) / 4;
    const boxHeight = 25;
    
    pillars.forEach((pillar, idx) => {
      const x = margin + (idx * (boxWidth + 5));
      
      pdf.setFillColor(51, 65, 85);
      pdf.roundedRect(x, yPosition, boxWidth, boxHeight, 3, 3, 'F');
      
      pdf.setFontSize(10);
      pdf.setTextColor(156, 163, 175);
      pdf.text(PILLAR_LABELS[idx], x + boxWidth / 2, yPosition + 8, { align: 'center' });
      
      if (pillar) {
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        const pillarText = `${pillar.heavenly_stem}${pillar.earthly_branch}`;
        pdf.text(pillarText, x + boxWidth / 2, yPosition + 18, { align: 'center' });
      }
    });
    
    yPosition += boxHeight + 15;
  }

  const addSection = (title: string, content: string) => {
    if (!content) return;
    
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      yPosition = margin;
    }
    
    pdf.setFontSize(14);
    pdf.setTextColor(245, 158, 11);
    pdf.text(title, margin, yPosition);
    yPosition += 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(200, 200, 200);
    
    const cleanContent = stripMarkdown(content);
    const lines = pdf.splitTextToSize(cleanContent, pageWidth - margin * 2);
    
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });
    
    yPosition += 10;
  };

  if (result.analysis?.easy_explanation) {
    addSection('쉬운 해설', result.analysis.easy_explanation);
  }
  
  if (result.analysis?.daily_master_analysis) {
    addSection('일간 특성', result.analysis.daily_master_analysis);
  }
  
  if (result.analysis?.geuk_analysis) {
    addSection('격국 분석', result.analysis.geuk_analysis);
  }
  
  if (result.analysis?.synthesis) {
    addSection('종합 분석', result.analysis.synthesis);
  }

  if (result.classical_references && result.classical_references.length > 0) {
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      yPosition = margin;
    }
    
    pdf.setFontSize(14);
    pdf.setTextColor(245, 158, 11);
    pdf.text('고전 문헌 참조', margin, yPosition);
    yPosition += 10;
    
    result.classical_references.slice(0, 3).forEach((ref) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = margin;
      }
      
      pdf.setFillColor(51, 65, 85);
      pdf.roundedRect(margin, yPosition, pageWidth - margin * 2, 20, 2, 2, 'F');
      
      pdf.setFontSize(9);
      pdf.setTextColor(245, 158, 11);
      pdf.text(ref.source, margin + 5, yPosition + 6);
      
      pdf.setTextColor(200, 200, 200);
      const refLines = pdf.splitTextToSize(ref.content, pageWidth - margin * 2 - 10);
      pdf.text(refLines.slice(0, 2).join(' '), margin + 5, yPosition + 14);
      
      yPosition += 25;
    });
  }

  yPosition = pageHeight - 20;
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `AI 사주 분석 리포트 | 생성일: ${new Date().toLocaleDateString('ko-KR')}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  pdf.text(
    '본 리포트는 참고용이며, 중요한 결정에는 전문가 상담을 권장합니다.',
    pageWidth / 2,
    yPosition + 5,
    { align: 'center' }
  );

  const filename = `AI사주_${result.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}

export async function generateQuickPDF(
  containerRef: HTMLElement,
  title: string
): Promise<void> {
  const canvas = await html2canvas(containerRef, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#1e293b',
    logging: false,
    windowWidth: containerRef.scrollWidth,
    windowHeight: containerRef.scrollHeight,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  let heightLeft = imgHeight;
  let position = 10;
  
  while (heightLeft > 0) {
    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 20);
    
    if (heightLeft > 0) {
      pdf.addPage();
      position = -(pageHeight - 20) * (Math.ceil((imgHeight - heightLeft) / (pageHeight - 20)));
    }
  }
  
  const filename = `${title}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
