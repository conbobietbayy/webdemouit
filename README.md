# UIT Campus Explorer

`UIT Campus Explorer` là demo web 3D tương tác dùng để trình diễn mô hình khuôn viên Trường Đại học Công nghệ Thông tin (UIT). Ứng dụng cho phép xem mô hình ở chế độ ban ngày, ban đêm, xoay quanh công trình bằng camera orbit và chuyển sang chế độ khám phá góc nhìn thứ nhất.

## Hình minh họa

![Giao diện UIT Campus Explorer](./Screenshot/Screenshot%202026-05-22%20214404.png)

## Tính năng chính

- Hiển thị mô hình 3D từ các file GLB trong thư mục `model/`.
- Chuyển đổi nhanh giữa hai bối cảnh ánh sáng: `Day` và `Night`.
- Điều khiển camera orbit: xoay, thu phóng, kéo khung nhìn và tự động xoay.
- Chế độ `Explore` cho phép di chuyển trong không gian 3D bằng góc nhìn thứ nhất.
- Ba preset camera: `Overview`, `Close` và `Top`.
- Thanh điều chỉnh `Exposure` để thay đổi cường độ hiển thị ánh sáng.
- Hiệu ứng hậu kỳ gồm SSAO, bloom, god rays và tone mapping.
- Bầu trời, mây, hạt bụi ban ngày, sao và hiệu ứng khí quyển ban đêm.
- Hỗ trợ va chạm cơ bản khi di chuyển trong chế độ khám phá.
- Giao diện responsive cho màn hình desktop và thiết bị nhỏ.

## Công nghệ sử dụng

- HTML, CSS và JavaScript ES Modules.
- Three.js để dựng cảnh 3D, camera, ánh sáng và tải mô hình GLB.
- Postprocessing để xử lý các hiệu ứng hình ảnh sau khi render.
- Cannon ES để mô phỏng vật lý và giới hạn va chạm cơ bản.
- Node.js HTTP server tùy chỉnh để chạy ứng dụng cục bộ.

## Cấu trúc thư mục

```txt
.
├── index.html              # Giao diện chính và import map
├── server.mjs              # HTTP server phục vụ file tĩnh
├── package.json            # Script chạy dự án và dependency
├── src/
│   ├── main.js             # Logic dựng cảnh, tải model, camera và tương tác
│   └── styles.css          # Giao diện, layout và responsive
├── model/                  # Mô hình 3D dùng trong ứng dụng
├── Screenshot/             # Ảnh minh họa giao diện
└── postprocessing/         # Mã thư viện postprocessing đi kèm dự án
```

## Yêu cầu môi trường

- Node.js 18 trở lên.
- Trình duyệt hiện đại có hỗ trợ WebGL 2.
- GPU hoặc card đồ họa tích hợp đủ khả năng render mô hình 3D.

## Cài đặt

Cài dependency của dự án:

```sh
npm install
```

## Chạy ứng dụng

Khởi động server local:

```sh
npm run serve
```

Sau đó mở trình duyệt tại:

```txt
http://localhost:4173
```

Có thể đổi cổng bằng biến môi trường `PORT`:

```sh
PORT=3000 npm run serve
```

Trên PowerShell:

```powershell
$env:PORT=3000; npm run serve
```

## Hướng dẫn sử dụng

### Điều khiển giao diện

- `Day` / `Night`: chuyển bối cảnh ánh sáng và mô hình tương ứng.
- `Exposure`: tăng hoặc giảm độ phơi sáng của cảnh.
- `Overview`, `Close`, `Top`: chuyển nhanh giữa các góc camera có sẵn.
- `Auto rotate`: bật hoặc tắt xoay tự động trong chế độ orbit.
- `Explore`: vào chế độ khám phá góc nhìn thứ nhất.
- `Reset camera`: đưa camera về góc nhìn tổng quan.

### Phím tắt

- `1`: chuyển về góc nhìn `Overview`.
- `2`: chuyển về góc nhìn `Close`.
- `3`: chuyển về góc nhìn `Top`.
- `W`, `A`, `S`, `D` hoặc phím mũi tên: di chuyển trong chế độ `Explore`.
- `Shift`: di chuyển nhanh hơn trong chế độ `Explore`.
- `Space`: nhảy trong chế độ `Explore`.
- `Q` / `E`: xoay hướng nhìn trong chế độ `Explore`.
- `Esc`: thoát chế độ `Explore`.

## Mô hình và tài nguyên

Ứng dụng đang sử dụng các mô hình chính:

- `model/Day.glb`: mô hình dùng cho bối cảnh ban ngày.
- `model/Night.glb`: mô hình dùng cho bối cảnh ban đêm.

Các file `.blend` trong thư mục `model/` là file nguồn Blender phục vụ chỉnh sửa hoặc xuất lại mô hình. Khi thay đổi mô hình, cần đảm bảo đường dẫn trong `src/main.js` khớp với tên file GLB mới.

## Ghi chú phát triển

- Server trong `server.mjs` có cấu hình MIME type cho `.glb`, `.gltf`, ảnh, CSS và JavaScript để trình duyệt tải đúng tài nguyên.
- Ứng dụng dùng import map trong `index.html`, vì vậy cần chạy qua server local thay vì mở trực tiếp file HTML.
- `node_modules/` không nên commit lên Git; chỉ cần giữ `package.json` và `package-lock.json`.
- Nếu mô hình hiển thị quá tối hoặc quá sáng, ưu tiên tinh chỉnh `Exposure`, ánh sáng trong `src/main.js` hoặc vật liệu trong file GLB.

## Script npm

```sh
npm run serve
npm start
```

Hai script trên đều chạy `server.mjs` và phục vụ ứng dụng tại cổng mặc định `4173`.
