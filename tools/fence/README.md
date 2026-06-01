# UIT Fence Picker

Tool nội bộ để pick ranh giới hàng rào, cổng và bảng hiệu trên model UIT.
`Day.glb` và `Night.glb` đang dùng chung hệ tọa độ, nên chỉ cần pick một lần.

## Chạy tool

Từ thư mục `webdemouit`:

```powershell
node tools/fence/server.mjs
```

Mở:

```text
http://localhost:4174
```

## Cách dùng

- Chọn `Fence` rồi click các điểm ranh giới hàng rào.
- Chọn `Gate` rồi click hai đầu đoạn cổng.
- Chọn `Sign` nếu muốn đánh dấu đoạn bảng hiệu trường.
- Bấm `Đóng vòng` nếu ranh giới là vòng kín.
- Bấm `Lưu public/fence` để ghi JSON vào `public/fence/`.
- Nếu đang mở bằng Vite thường, dùng `Tải JSON` rồi chép file vào `public/fence/`.

## Output

Mặc định lưu:

```text
public/fence/campus-fence-boundary.json
```

JSON gồm:

- `points`: các điểm đã pick, có `x`, `y`, `z`, `type`.
- `segments`: các đoạn nối điểm, có `from`, `to`, `type`, `length`.
- `closed`: ranh giới có đóng vòng hay không.
