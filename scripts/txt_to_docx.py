import sys
from docx import Document

def main():
    if len(sys.argv) < 3:
        print("Usage: python txt_to_docx.py <input_txt> <output_docx>")
        sys.exit(1)
        
    txt_path = sys.argv[1]
    docx_path = sys.argv[2]
    
    print(f"Converting TXT {txt_path} to DOCX {docx_path}...")
    
    try:
        doc = Document()
        
        # Read text line by line and add to paragraphs
        with open(txt_path, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                doc.add_paragraph(line.rstrip('\n'))
                
        doc.save(docx_path)
        print("Success")
    except Exception as e:
        print(f"Error during TXT to Word conversion: {e}", file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main()
