import { NextResponse } from 'next/server';

export async function GET() {
  const url = new URL('https://alpha.silvie.gg/api/spoilers?set=26,25,23,11');
  console.log('Request /api/gatcg_spoilers GET ' + url);
  const response = await fetch(url);
  const responseJson = await response.json();
  const dataContainer = {
    data: responseJson.spoilers,
  };
  for (let i = 0; i < dataContainer.data.length; i++) {
    dataContainer.data[i].uuid = crypto.randomUUID();
    dataContainer.data[i].name = dataContainer.data[i].card_name;
    dataContainer.data[i].card_image_url =
      'https://cgs.games/api/proxy/alpha.silvie.gg' + dataContainer.data[i].card_image_url;
    if (dataContainer.data[i].back_card && dataContainer.data[i].back_card.card_name) {
      dataContainer.data[i].back_card_name = dataContainer.data[i].back_card.card_name;
      dataContainer.data[i].back_card_image_url =
        'https://cgs.games/api/proxy/alpha.silvie.gg' +
        dataContainer.data[i].back_card.card_image_url;
    }
  }
  return new NextResponse(JSON.stringify(dataContainer), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
