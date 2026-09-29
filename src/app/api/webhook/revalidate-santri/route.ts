import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    
    // Ganti token ini dengan token rahasia yang sama di web PPDB
    const SECRET_TOKEN = process.env.REVALIDATE_WEBHOOK_SECRET;

    if (!SECRET_TOKEN) {
      console.error("REVALIDATE_WEBHOOK_SECRET belum dikonfigurasi");
      return NextResponse.json({ message: "Webhook belum dikonfigurasi" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${SECRET_TOKEN}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Revalidate data santri dan dufah yang kita tag
    revalidateTag("santri-data", {});

    return NextResponse.json({ 
      message: "Revalidation successful", 
      revalidated: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error during revalidation:", error);
    return NextResponse.json(
      { message: "Internal server error during revalidation" },
      { status: 500 }
    );
  }
}
