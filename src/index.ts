//iceportal api credentials
const client_id = "Loudface";
const client_secret = "shgrgsVkifzpUOOfVlscfUxs";
const auth_url = "https://auth.iceportal.com/connect/token";

////webflow API details
const collection_id = "653a726fd1db233f640f8716";

const imageCollection_id = "654414df47829cc60acf0a44";
const site_id = "6537a317fa220b9995fad407";
//webflow token
const token =
  "a559fcd350773138595015addce6cb82d87cb673268d97edf92379b5694ccf42";

const pageNo = 3;

document.getElementById("lorem").onsubmit = async (event) => {
  event.preventDefault();
  // Get the currently selected element in the Designer
  const el = await webflow.getSelectedElement();
  if (el && el.textContent) {
    // If we found the element and it has the ability to update the text content,
    // replace it with some placeholder text
    el.setTextContent(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do " +
        "eiusmod tempor incididunt ut labore et dolore magna aliqua."
    );
    // Finally, save the changes to the element & they will be reflected in the Designer
    await el.save();
  }
};

const btn = document.querySelector("#checkUpdate");
console.log(btn);
btn.addEventListener("click", (e) => {
  console.log("clicked");
});

//api link with Page number
const apiUrl = `https://api.iceportal.com/v1/listings?chainCode=aa%2Bbd&isPublished=true&pageNo=${pageNo}&includeSignaturePhoto=true`;
//https://api.iceportal.com/v1/listings?chainCode=aa%2Bbd&isPublished=true&pageNo=2&includeSignaturePhoto=true
//https://api.iceportal.com/v1/listings?chainCode=aa%2Bbd&includeSignaturePhoto=true
//https://api.iceportal.com/v1/listings?chainCode=aa%2Bbd&pageSize=2&includeSignaturePhoto=true

const updatesUrl = "";

///Getting the access token from Iceportal start
const getClientCredentialsToken = async () => {
  const payload = new URLSearchParams();
  payload.append("grant_type", "client_credentials");
  payload.append("client_id", client_id);
  payload.append("client_secret", client_secret);

  try {
    const response = await fetch(auth_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    if (response.ok) {
      const data = await response.json();
      const { access_token } = data;
      return access_token;
    }
    console.error("Failed to get token:", await response.text());
  } catch (error) {
    console.error(`Error in getting token: ${error}`);
  }
};
//////getting the access token end

///getting the cms item
///webflow API check
const options = {
  method: "GET",
  headers: {
    accept: "application/json",
  },
};

async function fetchExistingCMSItems() {
  let offsetNum = 0;
  let allItems = [];
  const limit = 100; //maximum items oer request
  let totalItems = 0;
  do {
    //cmslink URL
    const cmsItemsUrl = `https://api.webflow.com/v2/collections/${imageCollection_id}/items?offset=${offsetNum}&limit=100&access_token=${token}`;

    try {
      const response = await fetch(cmsItemsUrl, options);
      const data = await response.json();
      ///checking for error
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      console.log(data.pagination.total);
      const cmsDataItems = data.items;
      const iceDataInCms = cmsDataItems.map((item) => item.fieldData);
      allItems.push(...iceDataInCms);
      totalItems = data.pagination.total;
      offsetNum += limit;
    } catch (err) {
      console.error("Error fetching CMS items:", err);
    }
  } while (allItems.length < totalItems);
  return allItems;
}

//fetchExistingCMSItems();

///fetching data from Iceportal
async function fetchDataWithOAuth2(access_token) {
  // Set up the headers with the access token
  const headers = new Headers({
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json", // Adjust this based on the API's requirements
  });

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
    });
    //Checking for errors
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    const iceData = data.results;

    const cmsItems = await fetchExistingCMSItems();

    console.log(cmsItems);

    // Check if the item already exists in CMS

    // const itemExists = cmsItems.some((item) => item.listingid === listingID);

    //using the listing ID obtained to make anotherr API call to get the assets (images)

    const fullIceItem = iceData.map(async (eachData, i) => {
      //console.log(eachData.listingID, i);
      const listingID = eachData.listingID;
      // const [hotelType, countryCOde] = eachData.mappedID.split("-");
      // console.log(countryCOde);
      //   const [brand, country, lastcode] = data.mappedID.split("-");

      // Filter to find existing items in CMS
      // const existingItem = cmsItems.filter(
      //   (item) => item.listingid === listingID
      // );

      const itemExists = cmsItems.some((item) => item.listingid === listingID);
      //console.log(itemExists);

      if (!itemExists) {
        console.log(listingID);
        ///getting the properties with Listing IDs
        const newData = await fetch(
          `https://api.iceportal.com/v1/listings/${listingID}/assets?includeDisabledAssets=false&includeNotApprovedAssets=false
        `,
          { method: "GET", headers: headers }
        );
        const newDataItems = await newData.json();
        const fullIcedata = newDataItems.results;

        const OnlyimgData = fullIcedata.map((imgd) => {
          const imagArrayItem = imgd.links.cdnLinks[0];
          return imagArrayItem;
        });

        ////Trying to get other datas (Keywords)
        const keywords = fullIcedata
          .filter((keys) => {
            return keys.keywords;
          })
          .map((key) => key.keywords);

        //selecting the useful items from the keywords
        const [brand, type, country, area] = keywords[0];

        ////options for updating creating items cms
        const options = {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json", //content type very important when posting data
          },
          body: JSON.stringify({
            isArchived: false,
            isDraft: false,
            fieldData: {
              name: eachData.name,
              area: area,
              brand: brand,
              hoteltype: type,
              "country-code": country,
              listingid: listingID,

              thumbnail: {
                alt: null,
                url: OnlyimgData[0],
              },

              image: [
                {
                  alt: null,
                  url: OnlyimgData[0],
                },
                {
                  alt: null,
                  url: OnlyimgData[1],
                },
                {
                  alt: null,
                  url: OnlyimgData[2],
                },
                {
                  alt: null,
                  url: OnlyimgData[3],
                },
              ],
            },
          }),
        };

        //   activating the return create the cms items
        return fetch(
          `https://api.webflow.com/v2/collections/${imageCollection_id}/items?access_token=${token}`,
          options
        );
      } else {
        console.log(
          `item with listingID ${listingID} already exists in the cms`
        );
      }
    });
  } catch (error) {
    // Handle errors
    console.error("Fetch Error:", error);
  }
}

////Checking for update in the Iceportal assets
// async function checkUpdateIceportal(token: string) {
//   const headers = new Headers({
//     Authorization: `Bearer ${token}`,
//     "Content-Type": "application/json", // Adjust this based on the API's requirements
//   });

//   try {
//     const response = await fetch(updatesUrl, {
//       method: "GET",
//       headers: headers,
//     });
//     //Checking for errors
//     if (!response.ok) {
//       throw new Error("Network error in getting the updates from Iceportal");
//     }

//     const data = await response.json();
//     const updatedListings = data.results;
//     console.log(updatedListings);
//   } catch (error) {
//     console.log("update Fetch Error", error);
//   }
// }

// ///webflow API check
// const optionss = {
//   method: "GET",
//   headers: {
//     accept: "application/json",
//   },
//   // body: JSON.stringify({}),
// };

// // fetch(`https://api.webflow.com/v2/sites?access_token=${token}`, options)
// //   .then((response) => response.json())
// //   .then((response) => console.log(response))
// //   .catch((err) => console.error(err));

// async function fetchData() {
//   try {
//     const response = await fetch(
//       `https://api.webflow.com/v2/collections/${imageCollection_id}/items?access_token=${token}`,
//       options
//     );
//     const data = await response.json();
//     console.log(data);
//   } catch (err) {
//     console.error(err);
//   }
// }

//getting the authorized token and passing it to the fetch fata function
(async () => {
  const token = await getClientCredentialsToken();
  if (token) {
    console.log(`Received token: ${token}`);
    await fetchDataWithOAuth2(token);
  }
})();

//getting the authorized token and passinf g it to the fetch function to check for the updates
// (async () => {
//   const token = await getClientCredentialsToken();
//   if (token) {
//     console.log(`Received token: ${token}`);
//     await checkUpdateIceportal(token);
//   }
// })();
// Call the async function
//fetchData();
// const fullIceItem = iceData.map(async (eachData) => {
//   const listingID = eachData.listingID;
//   const newData = await fetch(
//     `https://api.iceportal.com/v1/listings/${listingID}`,
//     { method: "GET", headers: headers }
//   );
//   const newDataItems = await newData.json();
//   return newDataItems;
// });
