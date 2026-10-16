# Bản cập nhật nhân vật: Nếp & Chuông Rêu

**Trạng thái:** Prototype đã tích hợp; thông số là điểm khởi đầu để cân bằng, chưa phải canon/game balance cuối.

## Nếp — Người Gấp Lối

- **Vai trò:** kiểm soát tuyến và đánh dấu mục tiêu.
- **Đòn thường:** ghim mực bay, 2 HP mỗi lần trúng. Ba ghim trúng liên tiếp hoàn tất một dấu khảo sát; dấu thứ ba tạo vệt “gấp tuyến” hữu hình và thêm 2 HP sát thương.
- **Ultimate — Bản Đồ Chồng Lớp:** 8 nhịp gấp tuyến, mỗi nhịp 3 HP; trần lý thuyết 24 HP. Hiệu ứng nhắm quanh mục tiêu, không teleport.
- **Thể hiện:** áo choàng/bản đồ, ống bản đồ và la bàn; ghim mực màu vàng giấy, ba điểm neo và dải tuyến gấp.

## Chuông Rêu — Khu Vườn Biết Ngân

- **Vai trò:** gây áp lực bằng ba trạng thái môi trường.
- **Đòn thường:** sóng chuông 2 HP, luân phiên đúng ba nốt: **Mầm** (ngắt rất ngắn), **Sương** (giảm tốc đánh mục tiêu trong thời gian ngắn), **Gió** (đẩy lùi mạnh hơn). Vòng lặp trở lại Mầm sau Gió; không có nốt thứ tư.
- **Ultimate — Hòa Âm Tiểu Sinh Quyển:** 8 xung, mỗi xung 3 HP; tối đa 24 HP. Các nốt Mầm/Sương/Gió lần lượt áp dụng trạng thái tương ứng và hiện glyph/tên trên hiệu ứng.
- **Cái giá trong đấu trường:** Chuông Rêu phải đứng lại ngân trong lúc Ultimate hoạt động, nhưng vẫn nhận knockback/sát thương. Điều này thay thế rủi ro “tiếng lớn thu hút sinh vật” của concept khám phá vì trận arena không có quái ngoài.
- **Thể hiện:** thân chuông gỗ, vòm terrarium, rêu và các nốt có âm sắc/màu/feedback riêng.

## Phạm vi và cân bằng

- Roster cũ **Kiếm Sĩ, Cung Thủ, Mage** được giữ nguyên; Mage vẫn có Ultimate tối đa 80 HP như bản trước.
- Vì đây là auto-battler arena không có level/object tương tác, “anchor” của Nếp được rút gọn thành dấu tích lũy trên mục tiêu; không thêm puzzle, teleport, màn chơi hay backend.
- Cả hai Ultimate mới có trần danh nghĩa 24 HP. Cần playtest/tune tiếp; mô phỏng cục bộ kiểm tra được các trận kết thúc và giới hạn damage, nhưng không khẳng định đã cân bằng ngang với Mage.

## Chạy bản local

```bash
npm start
```

Mặc định server nghe cổng `3000`; có thể đặt `PORT`, ví dụ `PORT=4173 npm start`.
