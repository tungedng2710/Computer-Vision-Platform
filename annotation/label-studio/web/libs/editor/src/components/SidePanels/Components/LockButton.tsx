import { observer } from "mobx-react";
import type { FC } from "react";
import { IconLockLocked, IconLockUnlocked } from "@humansignal/icons";
import { RegionControlButton } from "./RegionControlButton";
import { FF_DEV_3873, isFF } from "../../../utils/feature-flags";
import type { ButtonProps } from "@humansignal/ui";
import type { HotkeyList } from "libs/editor/src/core/Hotkey";

export const LockButton: FC<{
  item: any;
  annotation: any;
  hovered: boolean;
  locked: boolean;
  hotkey?: string;
  look?: ButtonProps["look"];
  style?: ButtonProps["style"];
  displayedHotkey?: string;
  onClick: () => void;
}> = observer(({ item, annotation, hovered, locked, hotkey, displayedHotkey, look, style, onClick }) => {
  if (!item) return null;
  const isLocked = locked || item.isReadOnly() || annotation.isReadOnly();
  const isRegionReadonly = item.isReadOnly() && !locked;

  if (isFF(FF_DEV_3873)) {
    const styles = {
      ...style,
      display: item.isReadOnly() || locked ? undefined : "none",
    };

    return (
      <RegionControlButton
        disabled={isRegionReadonly}
        onClick={onClick}
        hotkey={hotkey as HotkeyList}
        look={look}
        style={styles}
      >
        {isLocked ? <IconLockLocked /> : <IconLockUnlocked />}
      </RegionControlButton>
    );
  }

  return (
    <RegionControlButton
      disabled={isRegionReadonly}
      onClick={onClick}
      displayedHotkey={displayedHotkey}
      hotkey={hotkey}
      look={look}
      style={style}
    >
      {isLocked ? <IconLockLocked /> : <IconLockUnlocked />}
    </RegionControlButton>
  );
});
