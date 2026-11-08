> 샘플 글입니다. 확인이 끝나면 지우거나 내용을 바꾸세요.

## 새 글 추가하기

1. `posts/` 폴더에 `my-new-post.md` 파일을 만든다 (파일 이름 = slug, 영문 소문자·숫자·하이픈만)
2. `posts/posts.json` 배열에 항목을 하나 추가한다

```json
{
  "slug": "my-new-post",
  "title": "새 글 제목",
  "date": "2026-11-10",
  "tags": ["firmware"],
  "summary": "목록에 보일 한두 줄 요약"
}
```

3. 커밋 & 푸시. 목록은 날짜 내림차순으로 자동 정렬됩니다. 잠깐 숨기려면 `"draft": true`를 넣으세요.

글 주소는 `/#p-my-new-post` 형태가 됩니다.

## 코드 블록

언어 이름을 적으면 하이라이트되고, 마우스를 올리면 복사 버튼이 나옵니다.

```bash
binwalk -Me firmware.bin
find _firmware.bin.extracted -name "*.so" | xargs strings -n 8 | grep -i passw
```

```python
import struct

def tpkt(payload: bytes) -> bytes:
    return struct.pack(">BBH", 3, 0, len(payload) + 4) + payload
```

```x86asm
mov  rdi, rsp
lea  rsi, [rip + shellcode]
call memcpy
```

## 표와 인용

| 항목 | 값 |
|---|---|
| target | sample-device |
| firmware | v1.0.0 |
| status | `reported` |

> 인용문은 왼쪽에 초록 선이 붙습니다.

## 이미지

`posts/img/` 폴더에 넣고 상대 경로로 쓰면 됩니다.

```markdown
![설명](img/screenshot.png)
```
