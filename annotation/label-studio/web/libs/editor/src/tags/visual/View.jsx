import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import Registry from "../../core/Registry";
import Tree from "../../core/Tree";
import Types from "../../core/Types";
import VisibilityMixin from "../../mixins/Visibility";
import { AnnotationMixin } from "../../mixins/AnnotationMixin";

/**
 * The `View` element is used to configure the display of blocks, similar to the div tag in HTML.
 * @example
 * <!-- Create two cards that flex to take up 50% of the screen width on the labeling interface -->
 * <View style="display: flex;">
 *   <!-- Left side -->
 *   <View style="flex: 50%">
 *     <Header value="Facts:" />
 *     <Text name="text" value="$fact" />
 *   </View>
 *   <!-- Right side -->
 *   <View style="flex: 50%; margin-left: 1em">
 *     <Header value="Enter your question:" />
 *     <TextArea name="question" />
 *   </View>
 * </View>
 * @example
 * <View>
 *   <Text name="text" value="$text"/>
 *   <Choices name="sentiment" toName="text">
 *     <Choice value="Positive"/>
 *     <Choice value="Negative"/>
 *     <Choice value="Neutral"/>
 *   </Choices>
 *   <!-- Shown only when Positive or Negative is selected -->
 *   <View visibleWhen="choice-selected" whenTagName="sentiment"
 *         whenChoiceValue="Positive,Negative">
 *     <Header value="Why?"/>
 *     <TextArea name="why_positive" toName="text"/>
 *   </View>
 * </View>
 * @example
 * <View>
 *   <Labels name="label" toName="text">
 *     <Label value="PER" background="red"/>
 *     <Label value="ORG" background="darkorange"/>
 *     <Label value="LOC" background="orange"/>
 *     <Label value="MISC" background="green"/>
 *   </Labels>
 *   <Text name="text" value="$text"/>
 *   <!-- Shown only when region PER or ORG is selected -->
 *   <View visibleWhen="region-selected" whenLabelValue="PER,ORG">
 *     <Header value="yoho"/>
 *   </View>
 * </View>
 * @name View
 * @meta_title View Tag for Defining How Blocks are Displayed
 * @meta_description Customize how blocks are displayed on the labeling interface in Label Studio for machine learning and data science projects.
 * @param {block|inline} display
 * @param {string} [style] CSS style string
 * @param {string} [className] - Class name of the CSS style to apply. Use with the Style tag
 * @param {string} [idAttr] - Unique ID attribute to use in CSS
 * @param {region-selected|choice-selected|no-region-selected|choice-unselected} [visibleWhen] Control visibility of the content. Can also be used with the `when*` parameters below to narrow visibility
 * @param {string} [whenTagName] Use with `visibleWhen`. Narrow down visibility by tag name. For regions, use the name of the object tag, for choices, use the name of the `choices` tag
 * @param {string} [whenLabelValue] Use with `visibleWhen="region-selected"`. Narrow down visibility by label value. Multiple values can be separated with commas
 * @param {string} [whenChoiceValue] Use with `visibleWhen` (`"choice-selected"` or `"choice-unselected"`) and `whenTagName`, both are required. Narrow down visibility by choice value. Multiple values can be separated with commas
 */
const TagAttrs = types.model({
  classname: types.optional(types.string, ""),
  display: types.optional(types.string, "block"),
  style: types.maybeNull(types.string),
  idattr: types.optional(types.string, ""),
});

const Model = types
  .model({
    id: types.identifier,
    type: "view",
    children: Types.unionArray([
      "view",
      "header",
      "labels",
      "label",
      "table",
      "taxonomy",
      "choices",
      "choice",
      "collapse",
      "datetime",
      "number",
      "rating",
      "ranker",
      "rectangle",
      "ellipse",
      "polygon",
      "keypoint",
      "brush",
      "bitmask",
      "magicwand",
      "rectanglelabels",
      "ellipselabels",
      "polygonlabels",
      "keypointlabels",
      "brushlabels",
      "hypertextlabels",
      "timeserieslabels",
      "bitmasklabels",
      "text",
      "audio",
      "image",
      "hypertext",
      "richtext",
      "timeseries",
      "audioplus",
      "list",
      "dialog",
      "textarea",
      "pairwise",
      "style",
      "relations",
      "filter",
      "pagedview",
      "paragraphs",
      "paragraphlabels",
      "pdf",
      "video",
      "videorectangle",
      "timelinelabels",
    ]),
  })
  .views((self) => ({
    // Indicates that it could exist without information about objects, taskData and regions
    get isIndependent() {
      return true;
    },
  }));

const ViewModel = types.compose("ViewModel", TagAttrs, Model, VisibilityMixin, AnnotationMixin);

const HtxView = observer(({ item }) => {
  let style = {};

  if (item.display === "inline") {
    style = { display: "inline-block", marginRight: "15px" };
  }

  if (item.style) {
    style = Tree.cssConverter(item.style);
  }

  if (item.isVisible === false) {
    style.display = "none";
  }

  return (
    <div id={item.idattr} className={item.classname} style={style}>
      {Tree.renderChildren(item, item.annotation)}
    </div>
  );
});

Registry.addTag("view", ViewModel, HtxView);

export { HtxView, ViewModel };
