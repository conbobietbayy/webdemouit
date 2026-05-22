# Hướng dẫn deploy UIT Campus Explorer lên Vercel và Cloudflare

Tài liệu này hướng dẫn cách đưa dự án `UIT Campus Explorer` lên Vercel và cấu hình tên miền đang quản lý bằng Cloudflare.

## Trạng thái hiện tại

Dự án đã được chuẩn bị để deploy lên Vercel bằng Vite.

Các phần đã cấu hình sẵn:

- `package.json` đã có script `dev`, `build`, `preview`, `serve` và `start`.
- `index.html` không còn dùng `importmap` trỏ trực tiếp vào `node_modules`.
- `vite.config.js` đã được thêm vào project.
- `vercel.json` đã được thêm vào project.
- Model production đã được đặt trong `public/model/`.
- `src/main.js` đang tải model từ `/model/Day.glb` và `/model/Night.glb`.

## Kiến trúc deploy đề xuất

```txt
GitHub repository
        |
        v
Vercel build
        |
        v
dist/ static files
        |
        v
Vercel Hosting
        |
        v
Cloudflare DNS
        |
        v
Tên miền riêng
```

## Bước 1: Kiểm tra local trước khi deploy

Chạy môi trường dev:

```sh
npm run dev
```

Mở đường dẫn Vite hiển thị trên terminal, thường là:

```txt
http://localhost:5173
```

Kiểm tra build production:

```sh
npm run build
```

Kiểm tra bản build:

```sh
npm run preview
```

Nếu mô hình 3D, CSS và các hiệu ứng đều tải bình thường thì có thể deploy.

## Bước 2: Đưa code lên GitHub

Nếu chưa có repository:

```sh
git init
git add .
git commit -m "Prepare Vercel deployment"
```

Tạo repository trên GitHub rồi push code lên.

Không commit `node_modules/`. Thư mục này nên được ignore trong `.gitignore`.

## Bước 3: Import project vào Vercel

1. Đăng nhập Vercel.
2. Chọn `Add New Project`.
3. Import repository GitHub của dự án.
4. Cấu hình:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Chọn `Deploy`.

Sau khi deploy xong, Vercel sẽ cung cấp một domain dạng:

```txt
https://ten-du-an.vercel.app
```

## Bước 4: Gắn tên miền riêng trên Vercel

Trong Vercel:

1. Vào project.
2. Chọn `Settings`.
3. Chọn `Domains`.
4. Nhập tên miền hoặc subdomain muốn dùng, ví dụ:

```txt
example.com
www.example.com
campus.example.com
```

Vercel sẽ hiển thị bản ghi DNS cần cấu hình.

## Bước 5: Cấu hình DNS trên Cloudflare

Vào Cloudflare, chọn domain của bạn, mở mục `DNS`.

### Trường hợp dùng domain gốc

Ví dụ:

```txt
example.com
```

Tạo bản ghi:

```txt
Type: A
Name: @
Value: 76.76.21.21
Proxy status: DNS only
```

### Trường hợp dùng subdomain

Ví dụ:

```txt
www.example.com
campus.example.com
```

Tạo bản ghi:

```txt
Type: CNAME
Name: www
Value: cname.vercel-dns.com
Proxy status: DNS only
```

Hoặc:

```txt
Type: CNAME
Name: campus
Value: cname.vercel-dns.com
Proxy status: DNS only
```

Nên để `DNS only` trong lần cấu hình đầu tiên để Vercel xác thực domain ổn định. Sau khi domain hoạt động, có thể bật proxy Cloudflare nếu thật sự cần.

## Bước 6: Cấu hình SSL trên Cloudflare

Trong Cloudflare:

1. Vào `SSL/TLS`.
2. Chọn chế độ `Full`.

Không nên dùng `Flexible` vì dễ gây lỗi redirect hoặc HTTPS không ổn định khi kết hợp với Vercel.

## Bước 7: Kiểm tra sau deploy

Sau khi DNS cập nhật, mở tên miền riêng và kiểm tra:

- Trang tải được qua HTTPS.
- Model `Day.glb` và `Night.glb` tải thành công.
- Chuyển `Day` / `Night` hoạt động.
- Camera orbit hoạt động.
- Chế độ `Explore` hoạt động.
- Ảnh, CSS và JavaScript không lỗi 404.
- Console trình duyệt không có lỗi import module.

## Lỗi thường gặp

### Lỗi không tìm thấy module trong `node_modules`

Nguyên nhân thường là vẫn còn `importmap` trỏ tới `./node_modules/...`.

Cách xử lý:

- Xóa `importmap` khỏi `index.html`.
- Dùng Vite để build.
- Deploy thư mục `dist/`.

### Model GLB bị lỗi 404

Kiểm tra lại đường dẫn trong `src/main.js`:

```js
const MODEL_URLS = {
  day: "./model/Day.glb",
  night: "./model/Night.glb",
};
```

Đảm bảo thư mục `model/` nằm trong project và được commit lên Git.

### Domain chưa nhận trên Vercel

Kiểm tra:

- DNS record đã đúng chưa.
- Proxy Cloudflare đang để `DNS only` chưa.
- Domain đã được thêm trong `Settings > Domains` của Vercel chưa.
- Chờ DNS cập nhật, thường mất vài phút nhưng có thể lâu hơn tùy nhà cung cấp.

## Kết luận

Cấu trúc hiện tại đã sẵn sàng để deploy Vercel bằng Vite. Sau khi build ra `dist/`, Vercel sẽ phục vụ dự án như một static site và Cloudflare chỉ cần quản lý DNS cho tên miền riêng.
