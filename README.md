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

Khởi động môi trường phát triển bằng Vite:

```sh
npm run dev
```

Sau đó mở trình duyệt tại địa chỉ Vite hiển thị trên terminal, thường là:

```txt
http://localhost:5173
```

Tạo bản build production:

```sh
npm run build
```

Kiểm tra bản build production trên máy local:

```sh
npm run preview
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

- Dự án dùng Vite để phát triển, build và deploy static site.
- Các model dùng ở production nằm trong `public/model/` để Vite tự copy sang `dist/model/`.
- `node_modules/` không nên commit lên Git; chỉ cần giữ `package.json` và `package-lock.json`.
- Nếu mô hình hiển thị quá tối hoặc quá sáng, ưu tiên tinh chỉnh `Exposure`, ánh sáng trong `src/main.js` hoặc vật liệu trong file GLB.
- File `vercel.json` đã được cấu hình sẵn để deploy lên Vercel.

## Script npm

```sh
npm run dev
npm run build
npm run preview
npm start
```

`npm start` và `npm run serve` hiện trỏ về Vite dev server để thuận tiện khi chạy local.
