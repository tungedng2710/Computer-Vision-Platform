---
title: Named Entity Recognition
type: templates
category: Natural Language Processing
cat: natural-language-processing
order: 203
meta_title: Text Named Entity Recognition Data Labeling Template
meta_description: Template for performing named entity recognition on text with Label Studio for your machine learning and data science projects.
---

<img src="/images/templates/named-entity-recognition.png" alt="" class="gif-border" width="552px" height="408px" />

If you want to perform named entity recognition (NER) on a sample of text, use this template. This template supports overlapping text spans and very large documents.

<a href="https://app.humansignal.com/b/MTk5"
  target="_blank" rel="noopener" aria-label="Open in Label Studio" style="all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;border:1px solid rgb(109,135,241);padding:8px 12px;background:rgb(87 108 193);color:white;font-weight:500;font-family:sans-serif;gap:6px;transition:background 0.2s ease;" onmouseover="this.style.background='rgb(97 122 218)'" onmouseout="this.style.background='rgb(87 108 193)'">
  <svg style="width:20px;height:20px" viewBox="0 0 26 26" fill="none"><path fill="none" d="M3.5 4.5h19v18h-19z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M25.7 7.503h-7.087V5.147H7.588V2.792h11.025V.436H25.7v7.067Zm-18.112 0H5.225v10.994H2.863V7.503H.5V.436h7.088v7.067Zm0 18.061v-7.067H.5v7.067h7.088ZM25.7 18.497v7.067h-7.088v-2.356H7.588v-2.355h11.025v-2.356H25.7Zm-2.363 0V7.503h-2.363v10.994h2.363Z" fill="white"/></svg>
  <span style="font-size:14px">Open in Label Studio</span>
  <svg style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" fill="white"/></svg>
</a>

## Interactive Template Preview

<div id="main-preview"></div>

## Labeling Configuration

```html
<View>
  <Labels name="label" toName="text">
    <Label value="PER" background="red"/>
    <Label value="ORG" background="darkorange"/>
    <Label value="LOC" background="orange"/>
    <Label value="MISC" background="green"/>
  </Labels>
  <Text name="text" value="$text"/>
</View>
```

## About the labeling configuration

All labeling configurations must be wrapped in [View](/tags/view.html) tags.

Use the Labels control tag to specify the relevant NER labels to apply to various text spans:
```xml
<Labels name="label" toName="text">
    <Label value="PER" background="red"/>
    <Label value="ORG" background="darkorange"/>
    <Label value="LOC" background="orange"/>
    <Label value="MISC" background="green"/>
</Labels>
```
Use the `background` parameter with the Label control tag to specify a CSS color for the label.

Use the Text object tag to specify the text data:
```xml
<Text name="text" value="$text"/>
```

## Enhance this template

You can enhance this template in many ways. 

### Display labels on the left

If you want to modify the appearance of the labeling interface, you can use styling on the [View](/tags/view.html) tag. In this example, display the NER labels to the left of the text to be labeled.

Start by setting the entire labeling interface display to flex:
```xml
<View style="display: flex;">
```

Then use a different [View](/tags/view.html) tag to wrap the labels. Because the labels are listed before the text, they appear
    on the left side of the interface.
```xml
<View style="width: 250px; margin-right: 1em; padding: 1em; background: #343c7f;">
```
The styling on this tag sets a width for the section of the interface with the labels, adds a right margin between the labels and the text, adds padding around the labels, and a background color for this section of the interface.

Then you can add the [Labels](/tags/labels.html) control tag like usual to display the NER labels:
```xml
  <Labels name="label" toName="text" showInline="false">
    <Label value="PER" background="red"/>
    <Label value="ORG" background="darkorange"/>
    <Label value="LOC" background="orange"/>
    <Label value="MISC" background="green"/>
  </Labels>
```
Close the [View](/tags/view.html) tag with the Labels, and open a new one for the Text tag:
```xml
</View>
<View>
```

The [Text](/tags/text.html) object tag specifies the text to label:
```xml
<Text name="text" value="$text"></Text>
```

Then you can close the two remaining View tags.

### Enforce word alignment

If you want to allow annotations of only full words and enforce word alignment in labeling tasks, you can use the `granularity` parameter on the [Text](/tags/text.html) object tag to make sure that all highlighted spans in a NER task are complete words.

For example, adjust your Text tag like follows:
```xml
<Text name="text" value="$text" granularity="word" />
```

### Add context to specific NER spans

If you want to add context to specific NER spans, you can set up conditional **per-region labeling** with your NER template.


For example, prompt annotators to choose the relevance of every text span in the text sample is:
```xml
<Choices name="relevance" toName="text" perRegion="true">
    <Choice value="Relevant" />
    <Choice value="Non Relevant" />
</Choices>
```
The `perRegion` parameter means that these choice options apply for each text span region. 

You can also combine the [View](/tags/view.html) tag and the `perRegion` parameter of the [Rating](/tags/rating.html) control tag to prompt annotators to rate their confidence in the accuracy of each individual text span region:
```xml
<View visibleWhen="region-selected">
    <Header value="Your confidence" />
</View>
<Rating name="confidence" toName="text" perRegion="true" />
```
The `visibleWhen` parameter with the View tag means that when a specific region is selected, the Header appears, prompting the annotator to supply a rating that applies to that region.

### Filter a long list of labels

If you want to filter a long list of labels, add the [Filter](/tags/filter.html) tag to your labeling configuration. For example, to filter the named entity recognition labels, add the following:
```xml
<Filter name="filter" toName="label" hotkey="shift+f" minlength="1" />
<Labels name="label" toName="text" showInline="false">
    <Label value="PER" background="red"/>
    <Label value="ORG" background="darkorange"/>
    <Label value="LOC" background="orange"/>
    <Label value="MISC" background="green"/>
</Labels>
```
The `toName` parameter on the Filter tag references the `name` parameter for the [Labels](/tags/labels.html) tag. You can also specify a `hotkey` to use for the filter text box, and set the `minlength` parameter to specify the minimum number of characters typed into the filter before the list of labels is filtered. 


## Related tags

- [View](/tags/view.html)
- [Labels](/tags/labels.html)
- [Text](/tags/text.html)