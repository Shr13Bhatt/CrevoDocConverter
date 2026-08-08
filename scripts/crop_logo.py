import os
from PIL import Image, ImageChops

def trim(im):
    # If the image has an alpha channel, trim transparent borders
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
        diff = ImageChops.difference(im, bg)
        diff = ImageChops.add(diff, diff, 2.0, -100)
        bbox = diff.getbbox()
        if bbox:
            return im.crop(bbox)
            
    # Fallback: trim white margins
    rgb_im = im.convert('RGB')
    bg_color = rgb_im.getpixel((0, 0))
    bg = Image.new('RGB', rgb_im.size, bg_color)
    diff = ImageChops.difference(rgb_im, bg)
    bbox = diff.getbbox()
    if bbox:
        w, h = im.size
        left = max(0, bbox[0] - 5)
        top = max(0, bbox[1] - 5)
        right = min(w, bbox[2] + 5)
        bottom = min(h, bbox[3] + 5)
        return im.crop((left, top, right, bottom))
    return im

def main():
    logo_path = 'public/logo.png'
    if not os.path.exists(logo_path):
        print("Logo not found!")
        return
        
    im = Image.open(logo_path)
    print(f"Original Logo size: {im.size}, mode: {im.mode}")
    cropped = trim(im)
    print(f"Cropped Logo size: {cropped.size}")
    cropped.save(logo_path)
    print("Logo cropped and saved successfully!")

if __name__ == '__main__':
    main()
