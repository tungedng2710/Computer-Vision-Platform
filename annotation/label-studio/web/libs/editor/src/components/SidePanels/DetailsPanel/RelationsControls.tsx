import { type FC, useCallback } from "react";
import { observer } from "mobx-react";
import { Block, Elem } from "../../../utils/bem";
import { Button } from "@humansignal/ui";
import "./RelationsControls.scss";
import { IconOutlinerEyeClosed, IconOutlinerEyeOpened, IconSortUp, IconSortDown } from "@humansignal/icons";

const RelationsControlsComponent: FC<any> = ({ relationStore }) => {
  return (
    <Block name="relation-controls">
      <ToggleRelationsVisibilityButton relationStore={relationStore} />
      <ToggleRelationsOrderButton relationStore={relationStore} />
    </Block>
  );
};

interface ToggleRelationsVisibilityButtonProps {
  relationStore: any;
}

const ToggleRelationsVisibilityButton = observer<FC<ToggleRelationsVisibilityButtonProps>>(({ relationStore }) => {
  const toggleRelationsVisibility = useCallback(
    (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      relationStore.toggleAllVisibility();
    },
    [relationStore],
  );

  const isDisabled = !relationStore?.relations?.length;
  const isAllHidden = !(!isDisabled && relationStore.isAllHidden);

  return (
    <Elem
      tag={Button}
      look="string"
      size="small"
      disabled={isDisabled}
      onClick={toggleRelationsVisibility}
      mod={{ hidden: isAllHidden }}
      aria-label={isAllHidden ? "Show all" : "Hide all"}
      icon={
        isAllHidden ? (
          <IconOutlinerEyeClosed width={16} height={16} />
        ) : (
          <IconOutlinerEyeOpened width={16} height={16} />
        )
      }
      tooltip={isAllHidden ? "Show all" : "Hide all"}
      tooltipTheme="dark"
    />
  );
});

interface ToggleRelationsOrderButtonProps {
  relationStore: any;
}

const ToggleRelationsOrderButton = observer<FC<ToggleRelationsOrderButtonProps>>(({ relationStore }) => {
  const toggleRelationsOrder = useCallback(
    (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      relationStore.toggleOrder();
    },
    [relationStore],
  );

  const isDisabled = !relationStore?.relations?.length;
  const isAsc = relationStore.order === "asc";

  return (
    <Elem
      tag={Button}
      look="string"
      size="small"
      onClick={toggleRelationsOrder}
      disabled={isDisabled}
      mod={{ order: relationStore.order }}
      aria-label={isAsc ? "Order by oldest" : "Order by newest"}
      icon={isAsc ? <IconSortUp /> : <IconSortDown />}
      tooltip={isAsc ? "Order by oldest" : "Order by newest"}
      tooltipTheme="dark"
    />
  );
});

export const RelationsControls = observer(RelationsControlsComponent);
