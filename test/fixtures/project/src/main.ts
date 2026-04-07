// 앱 엔트리 — main.* 패턴이라 flag 되지 않음
// path alias 사용 테스트: @features/app, @utils/logger
import { start } from "@features/app";
import { log } from "@utils/logger";

log("boot");
start();
