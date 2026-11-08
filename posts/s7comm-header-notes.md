> 샘플 글입니다. 블로그 레이아웃 확인용이니 지우거나 바꾸세요.

S7comm은 ISO-on-TCP(TCP/102) 위에서 돈다. 계층은 **TPKT → COTP → S7** 순서다. 연결 직후 클라이언트가 보내는 *Setup Communication* 요청 하나를 바이트 단위로 뜯어보자.

```text
00000000  03 00 00 19 02 f0 80 32  01 00 00 00 00 00 08 00  |.......2........|
00000010  00 f0 00 00 01 00 01 01  e0                       |.........|
```

## TPKT (4 bytes)

| offset | bytes | 의미 |
|---|---|---|
| 0x00 | `03` | version 3 |
| 0x01 | `00` | reserved |
| 0x02 | `00 19` | 전체 길이 = 25 bytes |

## COTP (3 bytes)

| offset | bytes | 의미 |
|---|---|---|
| 0x04 | `02` | header length (이 바이트 제외) |
| 0x05 | `f0` | PDU type = DT Data |
| 0x06 | `80` | last data unit (EOT) |

## S7 header (10 bytes, Job)

| offset | bytes | 의미 |
|---|---|---|
| 0x07 | `32` | protocol id |
| 0x08 | `01` | ROSCTR = Job |
| 0x09 | `00 00` | reserved |
| 0x0b | `00 00` | PDU reference |
| 0x0d | `00 08` | parameter length = 8 |
| 0x0f | `00 00` | data length = 0 |

ROSCTR 값: `0x01` Job, `0x02` Ack, `0x03` Ack_Data, `0x07` Userdata.

## Parameter (8 bytes)

| offset | bytes | 의미 |
|---|---|---|
| 0x11 | `f0` | function = Setup Communication |
| 0x12 | `00` | reserved |
| 0x13 | `00 01` | max AmQ calling |
| 0x15 | `00 01` | max AmQ called |
| 0x17 | `01 e0` | PDU length = 480 |

4 + 3 + 10 + 8 = 25 = `0x19` — TPKT 길이 필드와 일치한다.

```python
pkt = bytes.fromhex("0300001902f080320100000000000800" "00f0000001000101e0")
assert pkt[2:4] == len(pkt).to_bytes(2, "big")
assert pkt[7] == 0x32 and pkt[8] == 0x01   # S7, Job
```
