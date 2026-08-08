import sys
import os

def convert_doc_to_pdf(input_path, output_path):
    try:
        import aspose.words as aw
        print(f"Using aspose-words to convert {input_path} to {output_path}...")
        doc = aw.Document(input_path)
        doc.save(output_path)
        print("Success")
    except ImportError:
        print("Error: The 'aspose-words' package is required to convert legacy .doc files. "
              "Please install it using 'pip install aspose-words' in the virtual environment.", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Error during legacy Word conversion: {e}", file=sys.stderr)
        sys.exit(2)

def convert_ppt_to_pdf(input_path, output_path):
    try:
        import aspose.slides as slides
        print(f"Using aspose-slides to convert {input_path} to {output_path}...")
        with slides.Presentation(input_path) as presentation:
            presentation.save(output_path, slides.export.SaveFormat.PDF)
        print("Success")
    except ImportError:
        print("Error: The 'aspose-slides' package is required to convert legacy .ppt files. "
              "Please install it using 'pip install aspose-slides' in the virtual environment.", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Error during legacy PPT conversion: {e}", file=sys.stderr)
        sys.exit(2)

def main():
    if len(sys.argv) < 4:
        print("Usage: python doc_converter.py <mode> <input_file> <output_file>")
        sys.exit(1)
        
    mode = sys.argv[1].lower()  # 'doc2pdf' or 'ppt2pdf'
    input_file = sys.argv[2]
    output_file = sys.argv[3]
    
    if mode == 'doc2pdf':
        convert_doc_to_pdf(input_file, output_file)
    elif mode == 'ppt2pdf':
        convert_ppt_to_pdf(input_file, output_file)
    else:
        print(f"Unknown mode: {mode}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
