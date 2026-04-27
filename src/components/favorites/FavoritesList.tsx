
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Trash2, Bell } from "lucide-react";

const FavoritesList = () => {
  const [favorites, setFavorites] = useState([
    {
      id: 1,
      businessName: "Creative Design Studio",
      service: "Logo Design Package",
      price: 300,
      location: "New York, NY",
      rating: 4.8,
      availability: "Available now"
    },
    {
      id: 2,
      businessName: "Legal Advisory Group", 
      service: "Contract Review",
      price: 200,
      location: "Brooklyn, NY",
      rating: 4.9,
      availability: "Booking required"
    }
  ]);

  const removeFavorite = (id: number) => {
    setFavorites(favorites.filter(fav => fav.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Favorites</h2>
        <Badge variant="outline">{favorites.length} saved</Badge>
      </div>
      
      {favorites.map((favorite) => (
        <Card key={favorite.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium">{favorite.businessName}</h3>
                <p className="text-sm text-gray-600">{favorite.service}</p>
                <p className="text-sm text-gray-500">{favorite.location}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">${favorite.price}</Badge>
                  <Badge variant="secondary">{favorite.availability}</Badge>
                  <span className="text-sm">⭐ {favorite.rating}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => removeFavorite(favorite.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FavoritesList;
