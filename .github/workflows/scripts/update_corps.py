import requests
import zipfile
import xml.etree.ElementTree as ET
import json
import io
import os
import sys
import traceback

def main():
    api_key = os.environ.get('DART_API_KEY', '').strip()
    if not api_key:
        print("ERROR: DART_API_KEY is not set")
        sys.exit(1)

    print("Downloading DART corpCode.xml ...")
    url = 'https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=' + api_key

    try:
        resp = requests.get(url, timeout=60)
        print("HTTP status:", resp.status_code)
        resp.raise_for_status()
    except Exception as e:
        print("ERROR: download failed:", e)
        sys.exit(1)

    print("Downloaded", len(resp.content), "bytes")

    try:
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        print("ZIP contents:", names)

        xml_name = None
        for n in names:
            if n.upper() == 'CORPCODE.XML':
                xml_name = n
                break

        if not xml_name:
            print("ERROR: CORPCODE.XML not found in ZIP")
            sys.exit(1)

        xml_data = zf.read(xml_name)
        zf.close()
    except Exception as e:
        print("ERROR: ZIP parsing failed:", e)
        sys.exit(1)

    print("XML size:", len(xml_data), "bytes")

    try:
        xml_str = xml_data.decode('utf-8')
    except Exception:
        xml_str = xml_data.decode('euc-kr')

    print("Parsing XML ...")
    try:
        root = ET.fromstring(xml_str)
    except Exception as e:
        print("ERROR: XML parsing failed:", e)
        sys.exit(1)

    corps = []
    for item in root.findall('.//list'):
        code  = (item.findtext('corp_code')  or '').strip()
        name  = (item.findtext('corp_name')  or '').strip()
        stock = (item.findtext('stock_code') or '').strip()
        if code and name:
            corps.append([name, code, stock])

    print("Total companies:", len(corps))

    output = json.dumps(corps, ensure_ascii=False, separators=(',', ':'))
    with open('corps.json', 'w', encoding='utf-8') as f:
        f.write(output)

    print("Saved corps.json,", len(output), "bytes")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print("FATAL:", e)
        traceback.print_exc()
        sys.exit(1)
