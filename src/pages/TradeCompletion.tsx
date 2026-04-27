
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle, User } from "lucide-react";

const TradeCompletion = () => {
  const { tradeId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock trade data
  const tradeData = {
    id: tradeId,
    otherUser: "Digital Marketing Solutions",
    serviceReceived: "Social Media Management Setup",
    serviceProvided: "Legal Contract Review",
    completedDate: "December 15, 2024"
  };

  const handleStarClick = (starValue: number) => {
    setRating(starValue);
  };

  const handleStarHover = (starValue: number) => {
    setHoveredRating(starValue);
  };

  const handleSubmitReview = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    navigate('/account-dashboard', { state: { message: 'Review submitted successfully!' } });
  };

  const displayRating = hoveredRating || rating;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4"><BackButton /></div>
      <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Trade Completed!</CardTitle>
          <CardDescription>
            How was your experience with {tradeData.otherUser}?
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Trade Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-3">Trade Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">You received:</span>
                <span className="font-medium">{tradeData.serviceReceived}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">You provided:</span>
                <span className="font-medium">{tradeData.serviceProvided}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed on:</span>
                <span className="font-medium">{tradeData.completedDate}</span>
              </div>
            </div>
          </div>

          {/* Rating Section */}
          <div className="text-center">
            <h3 className="font-medium mb-4">Rate your experience</h3>
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => handleStarHover(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1.5 transition-colors"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= displayRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              {rating === 0 ? 'Click to rate' : 
               rating === 1 ? 'Poor' :
               rating === 2 ? 'Fair' :
               rating === 3 ? 'Good' :
               rating === 4 ? 'Very Good' : 'Excellent'}
            </p>
          </div>

          {/* Review Section */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Leave a review (optional)
            </label>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience with other users..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/account-dashboard')}
            >
              Skip Review
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmitReview}
              disabled={rating === 0 || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Your review helps build trust in our community
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default TradeCompletion;
