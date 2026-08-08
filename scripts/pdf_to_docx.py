import sys
from pdf2docx import Converter

def main():
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_docx.py <input_pdf> <output_docx>")
        sys.exit(1)
    
    pdf_file = sys.argv[1]
    docx_file = sys.argv[2]
    
    print(f"Converting {pdf_file} to {docx_file}...")
    
    try:
        cv = Converter(pdf_file)
        cv.convert(docx_file)  # converts all pages
        cv.close()
        print("Conversion Complete")
    except Exception as e:
        print(f"Conversion Error: {e}", file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main()
