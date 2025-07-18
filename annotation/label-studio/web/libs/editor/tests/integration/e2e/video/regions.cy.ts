import { Labels, LabelStudio, Sidebar, VideoView } from "@humansignal/frontend-test/helpers/LSF/index";
import { simpleVideoConfig, simpleVideoData, simpleVideoResult } from "../../data/video_segmentation/regions";
import { TWO_FRAMES_TIMEOUT } from "../utils/constants";

// This test suite has exhibited flakiness in CI environments, so we are using retries
// while we work on improving CI stability for visual comparisons.
const suiteConfig = {
  retries: {
    runMode: 3, // Retry 3 times in CI (headless mode)
    openMode: 0, // No retries in local development (interactive mode)
  },
};

describe("Video segmentation", suiteConfig, () => {
  it("Should be able to draw a simple rectangle", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult([]).init();

    LabelStudio.waitForObjectsReady();
    Sidebar.hasNoRegions();

    Labels.select("Label 1");

    VideoView.drawRectRelative(0.2, 0.2, 0.6, 0.6);

    Sidebar.hasRegions(1);
  });

  it("Should have changes in canvas", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult([]).init();
    LabelStudio.waitForObjectsReady();

    // Wait for video and regions to be fully loaded
    cy.wait(TWO_FRAMES_TIMEOUT);

    Sidebar.hasNoRegions();

    // Wait for video to be fully loaded and stable
    VideoView.captureCanvas("canvas");

    Labels.select("Label 2");
    VideoView.drawRectRelative(0.2, 0.2, 0.6, 0.6);

    // Ensure drawing operations are complete before comparison
    cy.wait(1000);

    Sidebar.hasRegions(1);

    VideoView.canvasShouldChange("canvas", 0);
  });
  // @todo: This test is flaky in CI, needs to be fixed
  it.skip("Should be invisible out of the lifespan (rectangle)", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult(simpleVideoResult).init();
    LabelStudio.waitForObjectsReady();
    // Wait for video and regions to be fully loaded
    cy.wait(1000);

    Sidebar.hasRegions(1);

    VideoView.captureCanvas("canvas");

    cy.wait(1000);

    VideoView.clickAtFrame(4);

    // Ensure drawing operations are complete before comparison
    cy.wait(1000);

    VideoView.canvasShouldChange("canvas", 0);
  });

  it("Should be invisible out of the lifespan (transformer)", () => {
    LabelStudio.params().config(simpleVideoConfig).data(simpleVideoData).withResult(simpleVideoResult).init();
    LabelStudio.waitForObjectsReady();
    // Wait for frame change to be fully processed
    cy.wait(1000);
    Sidebar.hasRegions(1);

    cy.log("Remember an empty canvas state");
    VideoView.clickAtFrame(4);
    cy.wait(1000);
    VideoView.captureCanvas("canvas");

    VideoView.clickAtFrame(3);
    cy.wait(TWO_FRAMES_TIMEOUT);
    cy.log("Select region");
    VideoView.clickAtRelative(0.5, 0.5);
    cy.wait(TWO_FRAMES_TIMEOUT);
    Sidebar.hasSelectedRegions(1);
    cy.wait(TWO_FRAMES_TIMEOUT);
    VideoView.clickAtFrame(4);
    cy.wait(TWO_FRAMES_TIMEOUT);
    Sidebar.hasSelectedRegions(1);

    cy.wait(1000);

    VideoView.canvasShouldNotChange("canvas", 0);
  });
});
