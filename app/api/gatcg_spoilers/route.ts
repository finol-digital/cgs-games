import { NextResponse } from 'next/server';

export async function GET() {
  const url = new URL('https://alpha.silvie.gg/api/spoilers?set=26,25,23,11');
  console.log('Request /api/gatcg_spoilers GET ' + url);
  const response = await fetch(url);
  const responseJson = await response.json();
  console.log(responseJson);
  const dataContainer: {
    data: {
      uuid: string;
      name: string;
      card_image_url: string;
      back_card_name: string;
      back_card_image_url: string;
    }[];
  } = {
    data: [],
  };
  for (let i = 0; i < responseJson.spoilers.length; i++) {
    dataContainer.data.push({
      uuid: '',
      name: '',
      card_image_url: '',
      back_card_name: '',
      back_card_image_url: '',
    });
    dataContainer.data[i].uuid = crypto.randomUUID();
    dataContainer.data[i].name = responseJson.spoilers[i].card_name;
    dataContainer.data[i].card_image_url =
      'https://cgs.games/api/proxy/alpha.silvie.gg' + responseJson.spoilers[i].card_image_url;
    if (responseJson.spoilers[i].back_card && responseJson.spoilers[i].back_card.card_name) {
      dataContainer.data[i].back_card_name = responseJson.spoilers[i].back_card.card_name;
      dataContainer.data[i].back_card_image_url =
        'https://cgs.games/api/proxy/alpha.silvie.gg' +
        responseJson.spoilers[i].back_card.card_image_url;
    }
  }
  console.log(dataContainer);
  return new NextResponse(JSON.stringify(dataContainer), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
