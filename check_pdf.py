"""
PDF 확인 및 텍스트 추출 테스트
"""
import os
import shutil
import fitz  # pymupdf

# 디렉토리에서 PDF 파일 찾기
pdf_dir = r"c:\AgenticAI_Trainning\ai_saju"

print("=== PDF 파일 검색 ===")
for f in os.listdir(pdf_dir):
    if f.lower().endswith('.pdf'):
        full_path = os.path.join(pdf_dir, f)
        print(f"Found: {f}")
        print(f"  Size: {os.path.getsize(full_path):,} bytes")
        
        # 영문명으로 복사
        new_path = os.path.join(pdf_dir, "ditiansuichanwei.pdf")
        if not os.path.exists(new_path):
            shutil.copy2(full_path, new_path)
            print(f"  Copied to: ditiansuichanwei.pdf")
        
        # PDF 열기 시도
        try:
            doc = fitz.open(full_path)
            print(f"  Pages: {len(doc)}")
            print(f"  Metadata: {doc.metadata.get('title', 'N/A')}")
            
            # 텍스트 추출 테스트
            text_pages = 0
            total_text = 0
            sample_text = ""
            
            for i in range(min(20, len(doc))):
                page = doc[i]
                text = page.get_text()
                if text.strip():
                    text_pages += 1
                    total_text += len(text)
                    if not sample_text and len(text) > 50:
                        sample_text = text[:500]
            
            if text_pages > 0:
                print(f"\n  Text extraction: SUCCESS")
                print(f"  Pages with text: {text_pages}/20 checked")
                print(f"  Total chars: {total_text:,}")
                print(f"\n  Sample text:")
                print(f"  {sample_text[:300]}...")
            else:
                print(f"\n  Text extraction: FAILED (scanned image PDF)")
                print(f"  OCR required for text extraction")
            
            doc.close()
        except Exception as e:
            print(f"  Error: {e}")
