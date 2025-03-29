import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Get the ID token from the Authorization header
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new NextResponse('Unauthorized - No token provided', { 
                status: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        // Verify the ID token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        if (!decodedToken) {
            return new NextResponse('Unauthorized - Invalid token', { 
                status: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        // Await the params to get the game ID
        const { id } = await params;
        const gameRef = adminDb.collection('games').doc(id);
        const gameDoc = await gameRef.get();

        if (!gameDoc.exists) {
            return new NextResponse('Game not found', { 
                status: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        // Check if the authenticated user owns the game
        const gameData = gameDoc.data();
        if (!gameData?.username) {
            return new NextResponse('Game data is invalid', { 
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        // Get the user's username from the users collection
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists) {
            return new NextResponse('User not found', { 
                status: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        const userData = userDoc.data();
        if (!userData?.username) {
            return new NextResponse('User data is invalid', { 
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        if (gameData.username !== userData.username) {
            return new NextResponse('Forbidden - You can only delete your own games', { 
                status: 403,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        await gameRef.delete();
        return new NextResponse('Game deleted successfully', { 
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    } catch (error) {
        console.error('Error deleting game:', error);
        return new NextResponse('Error deleting game', { 
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
} 