import sys
import os
import json
import fitz  # PyMuPDF

def main():
    if len(sys.argv) < 4:
        print("Usage: python pdf_to_images.py <input_pdf> <output_dir> <format_ext>")
        sys.exit(1)
    
    pdf_file = sys.argv[1]
    output_dir = sys.argv[2]
    format_ext = sys.argv[3].lower()  # 'jpg' or 'png'
    
    if format_ext not in ['jpg', 'jpeg', 'png']:
        format_ext = 'png'
    
    # map jpg to jpeg for fitz output save if needed, though fitz handles .jpg / .png fine
    if format_ext == 'jpg':
        save_format = 'jpeg'
    else:
        save_format = format_ext
        
    try:
        doc = fitz.open(pdf_file)
        generated_images = []
        
        os.makedirs(output_dir, exist_ok=True)
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            # Render page to image at 2.0x scale (approx. 150 DPI) for readability
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            image_name = f"page_{page_num + 1}.{format_ext}"
            image_path = os.path.join(output_dir, image_name)
            pix.save(image_path)
            
            # Record relative or absolute path
            generated_images.append(image_name)
            
        doc.close()
        
        # Return results as JSON on stdout
        print(json.dumps({
            "success": True,
            "images": generated_images
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }), file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main()
