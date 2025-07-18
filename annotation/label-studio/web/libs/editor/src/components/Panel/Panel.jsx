import { observer } from "mobx-react";
import { Button } from "@humansignal/ui";
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  RedoOutlined,
  RollbackOutlined,
  SettingOutlined,
  UndoOutlined,
} from "@ant-design/icons";

import styles from "./Panel.module.scss";
import Hint from "../Hint/Hint";

/**
 * Panel component with buttons:
 * Undo
 * Redo
 * Reset
 * Show Instructions
 * Settings
 */
export default observer(({ store }) => {
  const annotation = store.annotationStore.selected;
  const { history } = annotation;
  const classname = [styles.block, styles.block__controls, store.annotationStore.viewingAll ? styles.hidden : ""]
    .filter(Boolean)
    .join(" ");
  const panelClassName = cn("panel").toClassName();

  return (
    <div className={`${styles.container} ${panelClassName}`}>
      <div className={classname}>
        <Button
          look="string"
          leading={<UndoOutlined />}
          disabled={!history?.canUndo}
          onClick={(ev) => {
            annotation?.undo();
            ev.preventDefault();
          }}
        >
          Undo
          {store.settings.enableHotkeys && store.settings.enableTooltips && <Hint>[ Ctrl+z ]</Hint>}
        </Button>
        <Button
          look="string"
          disabled={!history?.canRedo}
          leading={<RedoOutlined />}
          onClick={(ev) => {
            annotation?.redo();
            ev.preventDefault();
          }}
        >
          Redo
        </Button>
        <Button
          type="ghost"
          disabled={!history?.canUndo}
          icon={<RollbackOutlined />}
          onClick={() => {
            history && history.reset();
          }}
        >
          Reset
        </Button>
        {store.setPrelabeling && (
          <Button
            variant="neutral"
            style={{ display: "none" }}
            onClick={() => {
              store.resetPrelabeling();
            }}
          >
            Reset Prelabeling
          </Button>
        )}
        {store.hasInterface("debug") && (
          <span>
            {history.undoIdx} / {history.history.length}
            {history.isFrozen && " (frozen)"}
          </span>
        )}
      </div>

      <div className={[styles.block, styles.common].join(" ")}>
        {store.description && store.showingDescription && (
          <Button
            variant="neutral"
            onClick={() => {
              store.toggleDescription();
            }}
          >
            Hide Instructions
          </Button>
        )}
        {store.description && !store.showingDescription && (
          <Button
            variant="neutral"
            onClick={() => {
              store.toggleDescription();
            }}
          >
            Instructions
          </Button>
        )}

        <Button
          variant="neutral"
          leading={<SettingOutlined />}
          onClick={(ev) => {
            store.toggleSettings();
            ev.preventDefault();
            return false;
          }}
        />
        <Button
          className="lsf-fs"
          variant="neutral"
          leading={store.settings.fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={(ev) => {
            store.settings.toggleFullscreen();
            ev.preventDefault();
            return false;
          }}
        />
      </div>
    </div>
  );
});
