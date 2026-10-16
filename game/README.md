# Đấu Trường Tốc Độ

Game auto-battler 2D pixel-art chạy trên trình duyệt, viết bằng HTML, CSS và JavaScript thuần. Kiếm Sĩ áp sát rồi chém AOE cự li gần, gây choáng ngắn; Cung Thủ tiếp tục bắn tên. Nhân vật nhận sát thương sẽ lóe đỏ và bị hất lùi nhẹ. Tốc độ đánh tăng từ 1.00 đến 2.08; Ultimate tự nạp và tự kích hoạt. Âm nhạc/SFX được tổng hợp bằng Web Audio API.

## Chạy cục bộ

Yêu cầu Node.js 20 trở lên. Không cần cài dependency.

```bash
npm start
```

Mở [http://localhost:3000](http://localhost:3000). Trong Manus Preview, dự án phục vụ trên cổng 3000.

## Chơi

1. Bấm **BẮT ĐẦU**.
2. Chọn nhân vật cho **Phe Trái**, rồi **Phe Phải**. Có thể chọn cùng một nhân vật cho cả hai.
3. Bấm **VÀO TRẬN**. Trận chiến và Ultimate tự vận hành.
4. Sau kết quả, chọn **CHƠI LẠI** hoặc **VỀ MENU**; nếu không chọn, game tự tái đấu sau 8 giây.
5. Dùng công tắc **ÂM THANH** ở thanh trên để bật/tắt âm thanh.

## Cơ chế chiến đấu

- **Kiếm Sĩ:** tự áp sát; mỗi đòn thường là một cung chém AOE trước mặt, tầm 128 px, choáng 0.38 giây và knockback mạnh hơn nhẹ (185 px/s trước giảm tốc). Đòn không phóng projectile.
- **Cung Thủ:** bắn projectile; nhịp bắn tăng theo Attack Speed.
- **Khi trúng đòn:** lóe đỏ 0.16 giây và nhận knockback hướng ra xa nguồn sát thương; vận tốc hất lùi giảm nhanh.
- **WORLD STASIS:** kéo dài 4 giây; arena chuyển xám, cả hai đấu sĩ ngừng di chuyển và ngừng đòn thường. Projectile đối phương đang có bị đóng băng. Kiếm Sĩ tung chính xác 20 đường chém trắng ở 20 góc khác nhau; mỗi nhát gây 2 HP, tối đa 40 HP sát thương trung bình. Ultimate khác đang diễn ra được tạm ngưng trong thời gian Stasis.
- **SPATIAL REND:** kéo dài 2.5 giây; mưa tên phủ vùng rộng và gây sát thương liên tục.

## Cấu trúc chính

- `public/index.html` — menu, hướng dẫn, chọn phe, arena và kết quả.
- `public/styles.css` — giao diện pixel-art responsive.
- `public/js/data.js` — danh sách nhân vật, kiểu `attack`, projectile và Ultimate.
- `public/js/engine.js` — mô phỏng, AI áp sát, stun, knockback, projectile/collision, HP, năng lượng và Ultimate.
- `public/js/renderer.js` — Canvas 2D, sprite, HP nổi, projectile, trail, lóe đỏ, dấu choáng và hiệu ứng chém.
- `public/js/audio.js` — nhạc nền cùng SFX tạo bằng Web Audio.
- `public/js/main.js` — luồng màn hình, chọn nhân vật, HUD và tự tái đấu.
- `server.mjs` — máy chủ tệp tĩnh tối thiểu để hỗ trợ Preview.
- `public/manus-routes.json` — khai báo route trang chủ.

## Thêm đấu sĩ

Thêm object vào mảng `CHARACTERS` trong `public/js/data.js` theo schema: `id`, `name`, `archetype`, `weapon`, `sprite`, `attack`, `projectile`, `ultimate` và `stats`. Dùng `attack.kind: 'melee_aoe'` cho cận chiến có AOE hoặc `'projectile'`/bỏ `attack` để dùng hệ bắn. Màn chọn đọc trực tiếp từ danh sách; projectile và Ultimate mới có hình/hiệu ứng tổng quát dự phòng khi chưa khai báo renderer riêng.

Attack Speed mặc định đạt 2.08 sau 90 giây; damage đòn thường tăng từ 1 đến tối đa 3 HP theo giai đoạn. Dữ liệu có thể điều chỉnh tầm AOE, cung chém, thời gian choáng, knockback, thời lượng Stasis, số nhát và damage mỗi nhát.
