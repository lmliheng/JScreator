ALTER TABLE `user`
ADD COLUMN `bio` varchar(255) DEFAULT NULL COMMENT '描述自己' AFTER `avatar`;

ALTER TABLE `user`
ADD COLUMN `area` varchar(255) DEFAULT NULL COMMENT '地区' AFTER `bio`;

ALTER TABLE `user`
ADD COLUMN `name` varchar(255) DEFAULT NULL COMMENT '姓名' AFTER `bio`;

ALTER TABLE `user`
ADD COLUMN `checkinDay` bigint DEFAULT 0 COMMENT '签到天数' AFTER `bio`;

ALTER TABLE `user`
ADD COLUMN `vip` bigint DEFAULT 0 COMMENT '会员等级' AFTER `bio`;