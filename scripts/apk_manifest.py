#!/usr/bin/env python3
"""Independent, dependency-free Android binary-manifest reader for site checks.

The Vercel build generator uses its own Node implementation. This Python
implementation deliberately re-reads the same binary APK manifest so the
structural check can verify generated metadata against the real file rather
than trusting the generator's own output.
"""
from __future__ import annotations

import re
import struct
import zipfile
from pathlib import Path
from typing import Any

RES_STRING_POOL_TYPE = 0x0001
RES_XML_TYPE = 0x0003
RES_XML_START_ELEMENT_TYPE = 0x0102
TYPE_REFERENCE = 0x01
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_HEX = 0x11
TYPE_INT_BOOLEAN = 0x12
UTF8_FLAG = 0x100
NO_ENTRY = 0xFFFFFFFF


def _u16(data: bytes, offset: int) -> int:
    return struct.unpack_from('<H', data, offset)[0]


def _u32(data: bytes, offset: int) -> int:
    return struct.unpack_from('<I', data, offset)[0]


def _clean(value: Any, max_length: int = 160) -> str | None:
    if not isinstance(value, str):
        return None
    clean = re.sub(r'[\x00-\x1f\x7f]', ' ', value).strip()[:max_length]
    return clean or None


def _parse_string_pool(data: bytes, offset: int, header_size: int, chunk_size: int) -> list[str]:
    if header_size < 28:
        raise ValueError('Binary XML string pool header is too small.')
    string_count, _style_count, flags, strings_start, _styles_start = struct.unpack_from(
        '<IIIII', data, offset + 8
    )
    offsets_start = offset + header_size
    data_start = offset + strings_start
    chunk_end = offset + chunk_size
    if data_start > chunk_end or offsets_start + string_count * 4 > chunk_end:
        raise ValueError('Binary XML string pool is out of bounds.')
    utf8 = bool(flags & UTF8_FLAG)
    strings: list[str] = []

    for index in range(string_count):
        pos = data_start + _u32(data, offsets_start + index * 4)
        if pos >= chunk_end:
            raise ValueError('Binary XML string offset is out of bounds.')
        if utf8:
            def read_length() -> int:
                nonlocal pos
                if pos >= chunk_end:
                    raise ValueError('Truncated UTF-8 binary XML string.')
                length = data[pos]
                pos += 1
                if length & 0x80:
                    if pos >= chunk_end:
                        raise ValueError('Truncated UTF-8 binary XML string length.')
                    length = ((length & 0x7F) << 8) | data[pos]
                    pos += 1
                return length

            read_length()  # UTF-16 code-unit count; byte count follows.
            byte_length = read_length()
            if pos + byte_length > chunk_end:
                raise ValueError('UTF-8 binary XML string is out of bounds.')
            strings.append(data[pos:pos + byte_length].decode('utf-8', errors='replace'))
        else:
            if pos + 2 > chunk_end:
                raise ValueError('Truncated UTF-16 binary XML string.')
            length = _u16(data, pos)
            pos += 2
            if length & 0x8000:
                if pos + 2 > chunk_end:
                    raise ValueError('Truncated UTF-16 binary XML string length.')
                length = ((length & 0x7FFF) << 16) | _u16(data, pos)
                pos += 2
            byte_length = length * 2
            if pos + byte_length > chunk_end:
                raise ValueError('UTF-16 binary XML string is out of bounds.')
            strings.append(data[pos:pos + byte_length].decode('utf-16le', errors='replace'))
    return strings


def _attribute_value(data: bytes, attr_offset: int, strings: list[str]) -> str | None:
    raw_value = _u32(data, attr_offset + 8)
    value_size, _res0, value_type, value_data = struct.unpack_from('<HBBI', data, attr_offset + 12)
    if raw_value != NO_ENTRY and raw_value < len(strings):
        return strings[raw_value]
    if value_type == TYPE_STRING and value_data < len(strings):
        return strings[value_data]
    if value_type in (TYPE_INT_DEC, TYPE_INT_HEX):
        return str(value_data)
    if value_type == TYPE_INT_BOOLEAN:
        return 'true' if value_data else 'false'
    if value_type == TYPE_REFERENCE:
        return None
    return None


def parse_binary_manifest(data: bytes) -> dict[str, Any]:
    if len(data) < 8 or _u16(data, 0) != RES_XML_TYPE:
        raise ValueError('AndroidManifest.xml is not binary XML.')
    document_size = _u32(data, 4)
    end = min(len(data), document_size or len(data))
    pos = _u16(data, 2)
    strings: list[str] = []
    result: dict[str, Any] = {
        'versionName': None,
        'versionCode': None,
        'packageName': None,
        'minSdkVersion': None,
        'targetSdkVersion': None,
    }

    while pos + 8 <= end:
        chunk_type, header_size, chunk_size = struct.unpack_from('<HHI', data, pos)
        if chunk_size < header_size or pos + chunk_size > end:
            raise ValueError('Malformed binary XML chunk.')
        if chunk_type == RES_STRING_POOL_TYPE:
            strings = _parse_string_pool(data, pos, header_size, chunk_size)
        elif chunk_type == RES_XML_START_ELEMENT_TYPE:
            ext = pos + header_size
            if ext + 20 <= pos + chunk_size:
                name_index = _u32(data, ext + 4)
                tag = strings[name_index] if name_index < len(strings) else ''
                attr_offset = _u16(data, ext + 8)
                attr_size = _u16(data, ext + 10)
                attr_count = _u16(data, ext + 12)
                for index in range(attr_count):
                    ap = ext + attr_offset + index * attr_size
                    if ap + 20 > pos + chunk_size:
                        break
                    attr_index = _u32(data, ap + 4)
                    attr_name = strings[attr_index] if attr_index < len(strings) else ''
                    value = _clean(_attribute_value(data, ap, strings))
                    if not value:
                        continue
                    if tag == 'manifest':
                        if attr_name == 'versionName':
                            result['versionName'] = value
                        elif attr_name == 'versionCode' and value.isdigit():
                            result['versionCode'] = int(value)
                        elif attr_name == 'package' and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.]*', value):
                            result['packageName'] = value
                    elif tag == 'uses-sdk':
                        if attr_name == 'minSdkVersion' and value.isdigit():
                            result['minSdkVersion'] = int(value)
                        elif attr_name == 'targetSdkVersion' and value.isdigit():
                            result['targetSdkVersion'] = int(value)
        pos += chunk_size
    return result


def read_apk_manifest(apk_path: str | Path) -> dict[str, Any]:
    """Read literal version/package/SDK facts from an APK's binary manifest."""
    with zipfile.ZipFile(apk_path) as apk:
        manifest = apk.read('AndroidManifest.xml')
    return parse_binary_manifest(manifest)
