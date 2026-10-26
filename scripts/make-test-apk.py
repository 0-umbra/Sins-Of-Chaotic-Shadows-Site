#!/usr/bin/env python3
"""Create tiny synthetic APK fixtures for scripts/test-apk-metadata.mjs.

These are not signed Android apps. They are real ZIP/APK containers with a
minimal binary AndroidManifest.xml, so the build-time generator's ZIP and AXML
readers can be tested against changed versions, sizes, encodings and failures.
"""
from __future__ import annotations

import argparse
import struct
import zipfile
from pathlib import Path

NO_ENTRY = 0xFFFFFFFF
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
RES_XML_TYPE = 0x0003
RES_STRING_POOL_TYPE = 0x0001
RES_XML_START_NAMESPACE_TYPE = 0x0100
RES_XML_END_NAMESPACE_TYPE = 0x0101
RES_XML_START_ELEMENT_TYPE = 0x0102
RES_XML_END_ELEMENT_TYPE = 0x0103
UTF8_FLAG = 0x100


def encode_utf8_length(value: int) -> bytes:
    if value < 0x80:
        return bytes([value])
    if value < 0x8000:
        return bytes([0x80 | ((value >> 8) & 0x7F), value & 0xFF])
    raise ValueError('Test string is too long for binary XML UTF-8 length encoding.')


def encode_utf16_length(value: int) -> bytes:
    if value < 0x8000:
        return struct.pack('<H', value)
    if value < 0x100000000:
        return struct.pack('<HH', 0x8000 | (value >> 16), value & 0xFFFF)
    raise ValueError('Test string is too long for binary XML UTF-16 length encoding.')


def string_pool(strings: list[str], utf8: bool) -> bytes:
    offsets: list[int] = []
    payload = bytearray()
    for text in strings:
        offsets.append(len(payload))
        char_length = len(text.encode('utf-16le')) // 2
        if utf8:
            encoded = text.encode('utf-8')
            payload += encode_utf8_length(char_length)
            payload += encode_utf8_length(len(encoded))
            payload += encoded + b'\x00'
        else:
            payload += encode_utf16_length(char_length)
            payload += text.encode('utf-16le') + b'\x00\x00'
    while len(payload) % 4:
        payload += b'\x00'

    header_size = 28
    strings_start = header_size + 4 * len(strings)
    chunk_size = strings_start + len(payload)
    flags = UTF8_FLAG if utf8 else 0
    header = struct.pack(
        '<HHIIIIII',
        RES_STRING_POOL_TYPE,
        header_size,
        chunk_size,
        len(strings),
        0,
        flags,
        strings_start,
        0,
    )
    return header + b''.join(struct.pack('<I', offset) for offset in offsets) + bytes(payload)


def namespace_chunk(start: bool, prefix: int, uri: int) -> bytes:
    chunk_type = RES_XML_START_NAMESPACE_TYPE if start else RES_XML_END_NAMESPACE_TYPE
    return struct.pack('<HHIIIII', chunk_type, 16, 24, 1, NO_ENTRY, prefix, uri)


def start_element(name: int, attributes: list[tuple[int, int, int, int, int]]) -> bytes:
    chunk_size = 16 + 20 + 20 * len(attributes)
    header = struct.pack(
        '<HHIIIIIHHHHHH',
        RES_XML_START_ELEMENT_TYPE,
        16,
        chunk_size,
        1,
        NO_ENTRY,
        NO_ENTRY,
        name,
        20,
        20,
        len(attributes),
        0,
        0,
        0,
    )
    body = bytearray()
    for ns, attr_name, raw_value, value_type, value_data in attributes:
        body += struct.pack(
            '<IIIHBBI',
            ns,
            attr_name,
            raw_value,
            8,
            0,
            value_type,
            value_data,
        )
    return header + bytes(body)


def end_element(name: int) -> bytes:
    return struct.pack(
        '<HHIIIII',
        RES_XML_END_ELEMENT_TYPE,
        16,
        24,
        1,
        NO_ENTRY,
        NO_ENTRY,
        name,
    )


def binary_manifest(*, version: str, version_code: int, package: str,
                    min_sdk: int, target_sdk: int, utf8: bool) -> bytes:
    strings = [
        'versionCode',                                  # 0
        'versionName',                                  # 1
        'package',                                      # 2
        version,                                        # 3
        package,                                        # 4
        'manifest',                                     # 5
        'android',                                      # 6
        'http://schemas.android.com/apk/res/android',    # 7
        'minSdkVersion',                                # 8
        'targetSdkVersion',                             # 9
        'uses-sdk',                                     # 10
    ]
    android_ns = 7
    chunks = [
        string_pool(strings, utf8),
        namespace_chunk(True, 6, 7),
        start_element(5, [
            (android_ns, 0, NO_ENTRY, TYPE_INT_DEC, version_code),
            (android_ns, 1, 3, TYPE_STRING, 3),
            (NO_ENTRY, 2, 4, TYPE_STRING, 4),
        ]),
        start_element(10, [
            (android_ns, 8, NO_ENTRY, TYPE_INT_DEC, min_sdk),
            (android_ns, 9, NO_ENTRY, TYPE_INT_DEC, target_sdk),
        ]),
        end_element(10),
        end_element(5),
        namespace_chunk(False, 6, 7),
    ]
    body = b''.join(chunks)
    return struct.pack('<HHI', RES_XML_TYPE, 8, 8 + len(body)) + body


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--version', default='9.8.7')
    parser.add_argument('--version-code', type=int, default=42)
    parser.add_argument('--package', default='com.example.scs')
    parser.add_argument('--min-sdk', type=int, default=24)
    parser.add_argument('--target-sdk', type=int, default=36)
    parser.add_argument('--compression', choices=('deflate', 'store'), default='deflate')
    parser.add_argument('--extra-bytes', type=int, default=1234)
    parser.add_argument('--utf8-strings', action='store_true')
    parser.add_argument('--omit-manifest', action='store_true')
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    compression = zipfile.ZIP_DEFLATED if args.compression == 'deflate' else zipfile.ZIP_STORED
    with zipfile.ZipFile(args.output, 'w', compression=compression) as apk:
        if not args.omit_manifest:
            manifest_info = zipfile.ZipInfo('AndroidManifest.xml', date_time=(1981, 1, 1, 0, 0, 0))
            manifest_info.compress_type = compression
            manifest_info.external_attr = 0o644 << 16
            apk.writestr(
                manifest_info,
                binary_manifest(
                    version=args.version,
                    version_code=args.version_code,
                    package=args.package,
                    min_sdk=args.min_sdk,
                    target_sdk=args.target_sdk,
                    utf8=args.utf8_strings,
                ),
            )
        apk.writestr('classes.dex', b'x' * max(0, args.extra_bytes))
        apk.writestr('META-INF/MANIFEST.MF', b'Manifest-Version: 1.0\r\n\r\n')
        apk.comment = b'scs-apk-metadata-test-fixture'
    print(args.output)


if __name__ == '__main__':
    main()
