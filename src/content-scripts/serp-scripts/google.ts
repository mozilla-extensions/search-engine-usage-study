import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, getXPathElements, getXPathElement, ElementType } from "../common.js"
import { getQueryVariable, searchEnginesMetadata } from "../../Utils.js"
import { onlineServicesMetadata } from "../../OnlineServiceData";

/**
 * Content Scripts for Google SERP
 */
const serpScript = function () {

    /**
     * @returns {boolean} Whether the page is a Google web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        return searchEnginesMetadata["Google"].getIsSerpPage(window.location.href);
    }

    /**
     * @returns {string} The category of online content the search query is for
     * (flights, hotels, other travel, maps, lyrics, weather, shopping, or other direct answer).
     */
    function getSerpQueryVertical(): string {
        return document.querySelector("[aria-current='page']").nextElementSibling.textContent;
    }

    /**
     * Determines what tracked online service an organic result is for.
     * @param {Element} organicResult - the organic result.
     * @returns {string} If the organic result was for one of the tracked online services, the name of the online service. Otherwise, an empty string.
     */
    function getOnlineServiceFromOrganicResult(organicResult: Element): string {
        try {
            const citeText = (organicResult.querySelector("a cite") as HTMLElement).innerText.toLowerCase();
            for (const metadata of onlineServicesMetadata) {
                const domain = metadata.domain;
                if (citeText.includes(domain)) {
                    return metadata.serviceName;
                }
            }
        } catch (error) {
            // Do nothing
        }
        return "";
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        const organicResults = Array.from(document.querySelectorAll("#rso .g:not(.rally-study-self-preferenced-tracking):not(.related-question-pair .g):not(.g .g):not(.kno-kp *):not(.kno-kp):not([data-async-type='editableDirectionsSearch'] .g)")).filter(element => {
            // Remove shopping results
            return !element.querySelector(":scope > g-card")
        });

        const organicDetails: OrganicDetail[] = [];
        const organicLinkElements: Element[][] = [];
        for (const organicResult of organicResults) {
            organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: null, onlineService: getOnlineServiceFromOrganicResult(organicResult) });
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]:not(.exp-c *)')).filter(organicLinkElement => {
                // Gets rid of link elements that are relative URLs. This gets rid of "Must include:" links
                // which are relative links to other Google SERP pages.
                try {
                    if (new URL(organicLinkElement.getAttribute("href"))) {
                        return true;
                    }
                } catch (error) {
                    // Do nothing
                }
                return false;
            }));

        }
        return { organicDetails: organicDetails, organicLinkElements: organicLinkElements };
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        // gets all basic keyword ads
        const keywordAds = document.querySelectorAll("[aria-label='Ads'] > div")

        // gets all text tags on page that are "Ad" or "Ads"
        const adTagElements = getXPathElements("//*[(normalize-space(text()) = 'Ad' or normalize-space(text()) = 'Ads') and not(ancestor::*[@aria-label='Ads'])]/../../../../..");

        // Creates a list from the non-keyword ads making sure that none of these non-keyword ads contain each other.
        // Is necessary because some ads on Google contain multiple ad tags
        const nonKeywordAds: Element[] = []
        for (let i = 0; i < adTagElements.length; i++) {
            let add = true
            for (let j = i + 1; j < adTagElements.length; j++) {
                if (adTagElements[i].contains(adTagElements[j]) || adTagElements[j].contains(adTagElements[i])) {
                    add = false
                    break;
                }
            }
            if (add === true) {
                nonKeywordAds.push(adTagElements[i])
            }
        }

        return nonKeywordAds.length + keywordAds.length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        // gets all basic keyword ads
        const keywordAds = document.querySelectorAll("[aria-label='Ads'] > div")

        // gets all text tags on page that are "Ad" or "Ads" but not within an [aria-label='Ads'] element
        const adTagElements = getXPathElements("//*[(normalize-space(text()) = 'Ad' or normalize-space(text()) = 'Ads') and not(ancestor::*[@aria-label='Ads'])]/../../../../..");

        // Creates a list from the non-keyword ads making sure that none of these non-keyword ads contain each other.
        // Is necessary because some ads on Google contain multiple ad tags
        const nonKeywordAds: Element[] = []
        for (let i = 0; i < adTagElements.length; i++) {
            let add = true
            for (let j = i + 1; j < adTagElements.length; j++) {
                if (adTagElements[i].contains(adTagElements[j]) || adTagElements[j].contains(adTagElements[i])) {
                    add = false
                    break;
                }
            }
            if (add === true) {
                nonKeywordAds.push(adTagElements[i])
            }
        }

        const adLinkElements: Element[] = [];
        const adResults = Array.from(keywordAds).concat(nonKeywordAds);
        for (const adResult of adResults) {
            adLinkElements.push(...Array.from(adResult.querySelectorAll("[href]")).filter(hrefElement => {
                return !getNormalizedUrl((hrefElement as any).href).includes("google.com/search");
            }));
        }

        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = (document.querySelector("#top_nav") as HTMLElement)
            return getElementBottomHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            let element = document.querySelector("#botstuff") as HTMLElement
            if (element.offsetHeight !== 0) {
                return getElementBottomHeight(element)
            }

            element = document.querySelector("#bottomads") as HTMLElement
            if (element.offsetHeight !== 0) {
                return getElementBottomHeight(element);
            }

            element = document.querySelector("#res") as HTMLElement
            return getElementBottomHeight(element);
        } catch (error) {
            return null;
        }

    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageElement = getXPathElement("//div[@role='navigation']//tbody/tr/td[normalize-space(text())]")
        return pageElement ? Number(pageElement.textContent) : -1;
    }

    /**
     * @returns {number} The number of results produced for the query by the search engine.
     */
    function getNumResults(): number {
        try {
            // The DOM element that contains the count
            const element = document.querySelector("#result-stats");

            // If the DOM element doesn't exist, we assume this means there are no results.
            if (!element) {
                return 0;
            } else {
                const sentence = element.textContent;

                // Format of string on Google is "About 1 results (0.34 seconds) "
                const extractedNumber: string = sentence.match(/[0-9,]+/g)[0].replace(/\D/g, '');
                if (extractedNumber == null || extractedNumber == "") {
                    return null;
                } else {
                    return Number(extractedNumber);
                }
            }
        } catch (error) {
            return null;
        }
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string|null} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        if (target.matches("#rcnt *, #appbar *, #atvcap *")) {
            if (!target.matches("[role=navigation] *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (isValidLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname.includes("google.com")) {
                            if (url.pathname === "/url") {
                                const newUrlString = getQueryVariable(href, "url");
                                const newUrl = new URL(newUrlString)
                                if (newUrl.hostname.includes("google.com")) {
                                    return newUrlString;
                                }
                            } else if (url.pathname.includes("/aclk")) {
                                return null;
                            } else {
                                return href;
                            }
                        }
                    } else {
                        return "";
                    }
                } else {
                    return "";
                }
            }
        }
        return null;
    }

    /**
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, internal click, or self preferencing click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = getNormalizedUrl(url);
        let redirectUrl = null;
        if (normalizedUrl.includes("google.com/url")) {
            redirectUrl = getQueryVariable(url, "url")
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("googleadservices.com/pagead") ||
                pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && pageValues.mostRecentMousedown.Link === redirectUrl)) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Ad Click");
                }
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && pageValues.mostRecentMousedown.Link === redirectUrl)) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Organic Click");
                }
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && (pageValues.mostRecentMousedown.Link === redirectUrl || redirectUrl[0] === "/") ||
                    normalizedUrl.includes("google.com/search"))) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Internal Click");
                }
                pageValues.numInternalClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.SelfPreferenced) {
            if (pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && (pageValues.mostRecentMousedown.Link === redirectUrl || redirectUrl[0] === "/") ||
                    normalizedUrl.includes("google.com/search"))) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Self Preferenced Click");
                }
                pageValues.numSelfPreferencedClicks++;

                try {
                    const urlObject = new URL(redirectUrl ? redirectUrl : url);
                    if (urlObject.hostname.includes("google.com")) {
                        if (__ENABLE_DEVELOPER_MODE__) {
                            console.log("Internal Click");
                        }
                        pageValues.numInternalClicks++;
                    }
                } catch (error) {
                    // Not internal link
                }
            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Google", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null, selfPreferencingType, getSerpQueryVertical, getNumResults);

    webScience.pageManager.onPageVisitStart.addListener(({ timeStamp }) => {
        pageValues.resetTracking(timeStamp);
        pageValues.determinePageValues();
    });

    webScience.pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
        pageValues.reportResults(timeStamp);
    });
};

waitForPageManagerLoad(serpScript);
